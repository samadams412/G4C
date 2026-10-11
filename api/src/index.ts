import express from "express";
import mysql from "mysql2/promise";
import Stripe from "stripe";
import { authenticate, loginHandler, registerHandler, requireAdmin } from "./auth";

const PORT = Number(process.env.PORT ?? 4000);

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "db",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: 5,
});

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ??
    (() => {
      throw new Error("STRIPE_SECRET_KEY is required");
    })()
);
const STRIPE_WEBHOOK_SECRET: string =
  process.env.STRIPE_WEBHOOK_SECRET ??
  (() => {
    throw new Error("STRIPE_WEBHOOK_SECRET is required");
  })();

const app = express();

// Stripe needs the raw request body to verify the webhook signature, so this
// route is registered before the global express.json() below.
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"] as string, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: "invalid signature" });
  }

  if (event.type !== "payment_intent.succeeded" && event.type !== "payment_intent.payment_failed") {
    return res.status(200).json({ received: true });
  }

  const paymentIntentId = (event.data.object as Stripe.PaymentIntent).id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      "SELECT order_id, status, reservation_expires_at < NOW() AS expired FROM orders WHERE stripe_payment_intent_id = ? FOR UPDATE",
      [paymentIntentId]
    );
    const order = (orderRows as { order_id: number; status: string; expired: number }[])[0];
    if (!order || order.status !== "Pending") {
      // Unknown order, or already finalized by a prior delivery of this webhook — no-op.
      await connection.rollback();
      return res.status(200).json({ received: true });
    }

    if (event.type === "payment_intent.succeeded" && order.expired) {
      // The reservation's TTL already expired before Stripe told us the charge
      // succeeded, so the capacity count has long since treated this spot as
      // free, and another order may already have taken it. Granting the
      // ticket now could oversell the event, so refund the charge and release
      // the reservation instead of silently finalizing it.
      console.error(
        `order ${order.order_id}: payment_intent.succeeded arrived after its reservation expired — refunding ${paymentIntentId} instead of finalizing, to avoid overselling the event`
      );
      await stripe.refunds.create({ payment_intent: paymentIntentId });
      await connection.query("UPDATE orders SET status = 'Refunded' WHERE order_id = ?", [order.order_id]);
      await connection.query("UPDATE ticket SET status = 'Refunded' WHERE order_id = ?", [order.order_id]);
    } else if (event.type === "payment_intent.succeeded") {
      await connection.query("UPDATE orders SET status = 'Completed' WHERE order_id = ?", [order.order_id]);
      await connection.query("UPDATE ticket SET status = 'Purchased' WHERE order_id = ?", [order.order_id]);
    } else {
      await connection.query("UPDATE orders SET status = 'Refunded' WHERE order_id = ?", [order.order_id]);
      await connection.query("UPDATE ticket SET status = 'Refunded' WHERE order_id = ?", [order.order_id]);
    }

    await connection.commit();
    res.status(200).json({ received: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "internal error" });
  } finally {
    connection.release();
  }
});

app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

function badRequest(res: express.Response, error: string) {
  return res.status(400).json({ error });
}

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "unreachable" });
  }
});

app.post("/auth/login", loginHandler(pool));
app.post("/auth/register", registerHandler(pool));

// Verification-only route for requireAdmin; no event/ticket/venue/category endpoints here.
app.get("/admin/ping", requireAdmin, (req, res) => {
  res.status(200).json({ ok: true, user: req.user });
});

const EVENT_STATUSES = ["Draft", "Published", "Completed", "Canceled"];
const TICKET_STATUSES = ["Reserved", "Purchased", "Refunded"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2}:\d{2})?$/;

app.get("/events", async (req, res) => {
  const { category, status, from, to } = req.query;
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);

  if (!Number.isInteger(page) || page < 1) {
    return badRequest(res, "page must be a positive integer");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return badRequest(res, "pageSize must be an integer between 1 and 100");
  }
  if (status !== undefined && (typeof status !== "string" || !EVENT_STATUSES.includes(status))) {
    return badRequest(res, `status must be one of ${EVENT_STATUSES.join(", ")}`);
  }
  if (category !== undefined && Number.isNaN(Number(category))) {
    return badRequest(res, "category must be a numeric category_id");
  }
  if (from !== undefined && (typeof from !== "string" || !DATE_RE.test(from))) {
    return badRequest(res, "from must be a date in YYYY-MM-DD format");
  }
  if (to !== undefined && (typeof to !== "string" || !DATE_RE.test(to))) {
    return badRequest(res, "to must be a date in YYYY-MM-DD format");
  }

  const where: string[] = [];
  const params: unknown[] = [];

  if (status !== undefined) {
    where.push("e.status = ?");
    params.push(status);
  }
  if (from !== undefined) {
    where.push("e.start_time >= ?");
    params.push(from);
  }
  if (to !== undefined) {
    where.push("e.start_time <= ?");
    params.push(to);
  }
  if (category !== undefined) {
    where.push(
      "e.event_id IN (SELECT event_id FROM event_category WHERE category_id = ?)"
    );
    params.push(Number(category));
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM event e ${whereClause}`,
      params
    );
    const total = (countRows as { total: number }[])[0].total;

    const [rows] = await pool.query(
      `SELECT e.event_id, e.organizer_id, e.venue_id, e.title, e.description,
              e.start_time, e.end_time, e.capacity, e.status
       FROM event e ${whereClause}
       ORDER BY e.start_time ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    const events = rows as { event_id: number }[];
    const eventIds = events.map((e) => e.event_id);
    const categoriesByEvent = new Map<number, { category_id: number; name: string }[]>();
    if (eventIds.length > 0) {
      const [categoryRows] = await pool.query(
        `SELECT ec.event_id, c.category_id, c.name
         FROM event_category ec
         JOIN category c ON c.category_id = ec.category_id
         WHERE ec.event_id IN (?)`,
        [eventIds]
      );
      for (const row of categoryRows as { event_id: number; category_id: number; name: string }[]) {
        const list = categoriesByEvent.get(row.event_id) ?? [];
        list.push({ category_id: row.category_id, name: row.name });
        categoriesByEvent.set(row.event_id, list);
      }
    }

    res.status(200).json({
      data: events.map((e) => ({ ...e, categories: categoriesByEvent.get(e.event_id) ?? [] })),
      page,
      pageSize,
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.get("/events/:id", async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId < 1) {
    return badRequest(res, "id must be a positive integer");
  }

  try {
    const [eventRows] = await pool.query(
      `SELECT e.event_id, e.organizer_id, e.title, e.description, e.start_time,
              e.end_time, e.capacity, e.status,
              v.venue_id, v.name AS venue_name, v.capacity AS venue_capacity,
              v.address AS venue_address, v.city AS venue_city
       FROM event e
       JOIN venue v ON v.venue_id = e.venue_id
       WHERE e.event_id = ?`,
      [eventId]
    );
    const row = (eventRows as Record<string, unknown>[])[0];
    if (!row) {
      return res.status(404).json({ error: "event not found" });
    }

    const [categoryRows] = await pool.query(
      `SELECT c.category_id, c.name
       FROM category c
       JOIN event_category ec ON ec.category_id = c.category_id
       WHERE ec.event_id = ?`,
      [eventId]
    );

    res.status(200).json({
      event_id: row.event_id,
      organizer_id: row.organizer_id,
      title: row.title,
      description: row.description,
      start_time: row.start_time,
      end_time: row.end_time,
      capacity: row.capacity,
      status: row.status,
      venue: {
        venue_id: row.venue_id,
        name: row.venue_name,
        capacity: row.venue_capacity,
        address: row.venue_address,
        city: row.venue_city,
      },
      categories: categoryRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.get("/venues", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT venue_id, name, capacity, address, city FROM venue ORDER BY venue_id ASC"
    );
    res.status(200).json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.get("/venues/:id", async (req, res) => {
  const venueId = Number(req.params.id);
  if (!Number.isInteger(venueId) || venueId < 1) {
    return badRequest(res, "id must be a positive integer");
  }

  try {
    const [rows] = await pool.query(
      "SELECT venue_id, name, capacity, address, city FROM venue WHERE venue_id = ?",
      [venueId]
    );
    const row = (rows as Record<string, unknown>[])[0];
    if (!row) {
      return res.status(404).json({ error: "venue not found" });
    }
    res.status(200).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.get("/categories", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT category_id, name FROM category ORDER BY category_id ASC"
    );
    res.status(200).json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.get("/tickets", async (req, res) => {
  const { event_id } = req.query;
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);

  if (!Number.isInteger(page) || page < 1) {
    return badRequest(res, "page must be a positive integer");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return badRequest(res, "pageSize must be an integer between 1 and 100");
  }
  if (event_id !== undefined && Number.isNaN(Number(event_id))) {
    return badRequest(res, "event_id must be a numeric event_id");
  }

  const whereClause = event_id !== undefined ? "WHERE event_id = ?" : "";
  const params = event_id !== undefined ? [Number(event_id)] : [];

  try {
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ticket ${whereClause}`, params);
    const total = (countRows as { total: number }[])[0].total;

    const [rows] = await pool.query(
      `SELECT ticket_id, order_id, event_id, user_id, price, status
       FROM ticket ${whereClause}
       ORDER BY ticket_id ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    res.status(200).json({ data: rows, page, pageSize, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.post("/events", requireAdmin, async (req, res) => {
  const body = req.body ?? {};
  const { organizer_id, venue_id, title, description, start_time, end_time, capacity } = body;
  const status = body.status ?? "Draft";

  if (!Number.isInteger(organizer_id) || organizer_id < 1) {
    return badRequest(res, "organizer_id must be a positive integer");
  }
  if (!Number.isInteger(venue_id) || venue_id < 1) {
    return badRequest(res, "venue_id must be a positive integer");
  }
  if (typeof title !== "string" || !title.trim()) {
    return badRequest(res, "title is required");
  }
  if (description !== undefined && typeof description !== "string") {
    return badRequest(res, "description must be a string");
  }
  if (typeof start_time !== "string" || !DATE_RE.test(start_time)) {
    return badRequest(res, "start_time must be a date in YYYY-MM-DD[ HH:MM:SS] format");
  }
  if (typeof end_time !== "string" || !DATE_RE.test(end_time)) {
    return badRequest(res, "end_time must be a date in YYYY-MM-DD[ HH:MM:SS] format");
  }
  if (new Date(start_time) >= new Date(end_time)) {
    return badRequest(res, "start_time must be before end_time");
  }
  if (!Number.isInteger(capacity) || capacity < 0) {
    return badRequest(res, "capacity must be a non-negative integer");
  }
  if (!EVENT_STATUSES.includes(status)) {
    return badRequest(res, `status must be one of ${EVENT_STATUSES.join(", ")}`);
  }

  try {
    const [organizerRows] = await pool.query("SELECT role FROM user WHERE user_id = ?", [organizer_id]);
    const organizer = (organizerRows as { role: string }[])[0];
    if (!organizer) {
      return badRequest(res, "organizer_id does not reference an existing user");
    }
    if (organizer.role !== "Organizer" && organizer.role !== "Admin") {
      return badRequest(res, "organizer_id must reference a user with role Organizer or Admin");
    }

    const [venueRows] = await pool.query("SELECT capacity FROM venue WHERE venue_id = ?", [venue_id]);
    const venue = (venueRows as { capacity: number }[])[0];
    if (!venue) {
      return badRequest(res, "venue_id does not reference an existing venue");
    }
    if (capacity > venue.capacity) {
      return badRequest(res, "capacity cannot exceed the venue's capacity");
    }

    const [result] = await pool.query(
      `INSERT INTO event (organizer_id, venue_id, title, description, start_time, end_time, capacity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [organizer_id, venue_id, title, description ?? null, start_time, end_time, capacity, status]
    );
    const insertId = (result as { insertId: number }).insertId;

    res.status(201).json({
      event_id: insertId,
      organizer_id,
      venue_id,
      title,
      description: description ?? null,
      start_time,
      end_time,
      capacity,
      status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.put("/events/:id", requireAdmin, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId < 1) {
    return badRequest(res, "id must be a positive integer");
  }

  try {
    const [existingRows] = await pool.query("SELECT * FROM event WHERE event_id = ?", [eventId]);
    const existing = (existingRows as Record<string, any>[])[0];
    if (!existing) {
      return res.status(404).json({ error: "event not found" });
    }

    const body = req.body ?? {};
    const organizer_id = body.organizer_id ?? existing.organizer_id;
    const venue_id = body.venue_id ?? existing.venue_id;
    const title = body.title ?? existing.title;
    const description = body.description !== undefined ? body.description : existing.description;
    const start_time = body.start_time ?? existing.start_time;
    const end_time = body.end_time ?? existing.end_time;
    const capacity = body.capacity ?? existing.capacity;
    const status = body.status ?? existing.status;

    if (!Number.isInteger(organizer_id) || organizer_id < 1) {
      return badRequest(res, "organizer_id must be a positive integer");
    }
    if (!Number.isInteger(venue_id) || venue_id < 1) {
      return badRequest(res, "venue_id must be a positive integer");
    }
    if (typeof title !== "string" || !title.trim()) {
      return badRequest(res, "title is required");
    }
    if (body.start_time !== undefined && (typeof body.start_time !== "string" || !DATE_RE.test(body.start_time))) {
      return badRequest(res, "start_time must be a date in YYYY-MM-DD[ HH:MM:SS] format");
    }
    if (body.end_time !== undefined && (typeof body.end_time !== "string" || !DATE_RE.test(body.end_time))) {
      return badRequest(res, "end_time must be a date in YYYY-MM-DD[ HH:MM:SS] format");
    }
    if (new Date(start_time) >= new Date(end_time)) {
      return badRequest(res, "start_time must be before end_time");
    }
    if (!Number.isInteger(capacity) || capacity < 0) {
      return badRequest(res, "capacity must be a non-negative integer");
    }
    if (!EVENT_STATUSES.includes(status)) {
      return badRequest(res, `status must be one of ${EVENT_STATUSES.join(", ")}`);
    }

    const [organizerRows] = await pool.query("SELECT role FROM user WHERE user_id = ?", [organizer_id]);
    const organizer = (organizerRows as { role: string }[])[0];
    if (!organizer) {
      return badRequest(res, "organizer_id does not reference an existing user");
    }
    if (organizer.role !== "Organizer" && organizer.role !== "Admin") {
      return badRequest(res, "organizer_id must reference a user with role Organizer or Admin");
    }

    const [venueRows] = await pool.query("SELECT capacity FROM venue WHERE venue_id = ?", [venue_id]);
    const venue = (venueRows as { capacity: number }[])[0];
    if (!venue) {
      return badRequest(res, "venue_id does not reference an existing venue");
    }
    if (capacity > venue.capacity) {
      return badRequest(res, "capacity cannot exceed the venue's capacity");
    }

    await pool.query(
      `UPDATE event SET organizer_id=?, venue_id=?, title=?, description=?, start_time=?, end_time=?, capacity=?, status=?
       WHERE event_id=?`,
      [organizer_id, venue_id, title, description ?? null, start_time, end_time, capacity, status, eventId]
    );

    res.status(200).json({
      event_id: eventId,
      organizer_id,
      venue_id,
      title,
      description: description ?? null,
      start_time,
      end_time,
      capacity,
      status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.post("/tickets", requireAdmin, async (req, res) => {
  const body = req.body ?? {};
  const { order_id, event_id, user_id, price } = body;
  const status = body.status ?? "Reserved";
  const ticket_id =
    typeof body.ticket_id === "string" && body.ticket_id.trim()
      ? body.ticket_id
      : `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (!Number.isInteger(order_id) || order_id < 1) {
    return badRequest(res, "order_id must be a positive integer");
  }
  if (!Number.isInteger(event_id) || event_id < 1) {
    return badRequest(res, "event_id must be a positive integer");
  }
  if (!Number.isInteger(user_id) || user_id < 1) {
    return badRequest(res, "user_id must be a positive integer");
  }
  if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
    return badRequest(res, "price must be a non-negative number");
  }
  if (!TICKET_STATUSES.includes(status)) {
    return badRequest(res, `status must be one of ${TICKET_STATUSES.join(", ")}`);
  }

  try {
    const [orderRows] = await pool.query("SELECT order_id FROM orders WHERE order_id = ?", [order_id]);
    if (!(orderRows as unknown[])[0]) {
      return badRequest(res, "order_id does not reference an existing order");
    }

    const [userRows] = await pool.query("SELECT status FROM user WHERE user_id = ?", [user_id]);
    const user = (userRows as { status: string }[])[0];
    if (!user) {
      return badRequest(res, "user_id does not reference an existing user");
    }
    if (user.status === "Suspended") {
      return badRequest(res, "cannot issue a ticket to a Suspended user");
    }

    const [eventRows] = await pool.query("SELECT status, capacity FROM event WHERE event_id = ?", [event_id]);
    const event = (eventRows as { status: string; capacity: number }[])[0];
    if (!event) {
      return badRequest(res, "event_id does not reference an existing event");
    }
    if (event.status !== "Published") {
      return badRequest(
        res,
        `cannot issue a ticket for an event with status ${event.status}; event must be Published`
      );
    }

    const [countRows] = await pool.query(
      "SELECT COUNT(*) AS sold FROM ticket WHERE event_id = ? AND status != 'Refunded'",
      [event_id]
    );
    const sold = (countRows as { sold: number }[])[0].sold;
    if (sold >= event.capacity) {
      return badRequest(res, "event is at capacity; no more tickets may be sold");
    }

    await pool.query(
      "INSERT INTO ticket (ticket_id, order_id, event_id, user_id, price, status) VALUES (?, ?, ?, ?, ?, ?)",
      [ticket_id, order_id, event_id, user_id, price, status]
    );

    res.status(201).json({ ticket_id, order_id, event_id, user_id, price, status });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return badRequest(res, "ticket_id already exists");
    }
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

// Attendee-facing self-service purchase: unlike POST /tickets above, this
// never accepts a caller-supplied user_id or price, creates its own order,
// and locks the event row for the duration of the capacity check + insert so
// two concurrent purchases for the same event can't both succeed past
// capacity.
//
// This reserves spots rather than issuing tickets outright: it creates a
// Stripe PaymentIntent and inserts 'Reserved' tickets against a 'Pending'
// order in the same transaction. The order's reservation_expires_at gives
// the reservation a TTL — the capacity count below treats an expired
// Reserved ticket as free, so a stuck PaymentIntent doesn't block the event
// forever even without a cleanup job. POST /webhooks/stripe finalizes
// (payment_intent.succeeded) or releases (payment_intent.payment_failed) the
// reservation once Stripe reports back.
const MAX_TICKETS_PER_PURCHASE = 8;
const RESERVATION_TTL_MINUTES = 15;

app.post("/tickets/purchase", authenticate, async (req, res) => {
  const { event_id, quantity } = req.body ?? {};

  if (!Number.isInteger(event_id) || event_id < 1) {
    return badRequest(res, "event_id must be a positive integer");
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_PURCHASE) {
    return badRequest(res, `quantity must be an integer between 1 and ${MAX_TICKETS_PER_PURCHASE}`);
  }

  const userId = req.user!.user_id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userRows] = await connection.query("SELECT status FROM user WHERE user_id = ?", [userId]);
    const user = (userRows as { status: string }[])[0];
    if (!user) {
      await connection.rollback();
      return badRequest(res, "user account no longer exists");
    }
    if (user.status === "Suspended") {
      await connection.rollback();
      return res.status(403).json({ error: "this account is suspended and cannot purchase tickets" });
    }

    const [eventRows] = await connection.query(
      "SELECT status, capacity FROM event WHERE event_id = ? FOR UPDATE",
      [event_id]
    );
    const event = (eventRows as { status: string; capacity: number }[])[0];
    if (!event) {
      await connection.rollback();
      return badRequest(res, "event_id does not reference an existing event");
    }
    if (event.status !== "Published") {
      await connection.rollback();
      return badRequest(res, "this event isn't open for ticket sales");
    }

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS sold FROM ticket t
       JOIN orders o ON o.order_id = t.order_id
       WHERE t.event_id = ?
         AND (t.status = 'Purchased' OR (t.status = 'Reserved' AND o.reservation_expires_at > NOW()))`,
      [event_id]
    );
    const sold = (countRows as { sold: number }[])[0].sold;
    const remaining = event.capacity - sold;
    if (quantity > remaining) {
      await connection.rollback();
      return badRequest(
        res,
        remaining <= 0 ? "this event is sold out" : `only ${remaining} spot${remaining === 1 ? "" : "s"} left`
      );
    }

    const [priceRows] = await connection.query(
      "SELECT MIN(price) AS min_price FROM ticket WHERE event_id = ? AND status != 'Refunded'",
      [event_id]
    );
    const minPrice = (priceRows as { min_price: string | null }[])[0].min_price;
    if (minPrice === null) {
      await connection.rollback();
      return badRequest(res, "ticket pricing hasn't been set for this event yet");
    }
    const pricePerTicket = Number(minPrice);
    const totalAmount = Math.round(pricePerTicket * quantity * 100) / 100;

    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, total_amount, status, reservation_expires_at)
       VALUES (?, ?, 'Pending', DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [userId, totalAmount, RESERVATION_TTL_MINUTES]
    );
    const orderId = (orderResult as { insertId: number }).insertId;

    const ticketIds: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const ticketId = `TKT-${orderId}-${i + 1}-${Math.random().toString(36).slice(2, 8)}`;
      await connection.query(
        "INSERT INTO ticket (ticket_id, order_id, event_id, user_id, price, status) VALUES (?, ?, ?, ?, ?, 'Reserved')",
        [ticketId, orderId, event_id, userId, pricePerTicket, "Reserved"]
      );
      ticketIds.push(ticketId);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100),
      currency: "usd",
      // No frontend to redirect back to here (CLI/API-only flow), so disallow
      // redirect-based payment methods rather than requiring a return_url.
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { order_id: String(orderId), event_id: String(event_id) },
    });

    await connection.query("UPDATE orders SET stripe_payment_intent_id = ? WHERE order_id = ?", [
      paymentIntent.id,
      orderId,
    ]);

    await connection.commit();
    res.status(201).json({
      order_id: orderId,
      ticket_ids: ticketIds,
      price_per_ticket: pricePerTicket,
      total_amount: totalAmount,
      quantity,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      reserved_until: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60_000).toISOString(),
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "internal error" });
  } finally {
    connection.release();
  }
});

// Lets the purchaser (or an admin) poll whether a reservation has been
// finalized yet — the frontend uses this to wait for POST /webhooks/stripe
// to land rather than trusting the client-side Stripe confirmation alone.
app.get("/orders/:id", authenticate, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return badRequest(res, "id must be a positive integer");
  }

  try {
    const [orderRows] = await pool.query(
      "SELECT order_id, user_id, status, total_amount FROM orders WHERE order_id = ?",
      [orderId]
    );
    const order = (orderRows as { order_id: number; user_id: number; status: string; total_amount: string }[])[0];
    if (!order) {
      return res.status(404).json({ error: "order not found" });
    }
    if (order.user_id !== req.user!.user_id && req.user!.role !== "Admin") {
      return res.status(403).json({ error: "not your order" });
    }

    const [ticketRows] = await pool.query("SELECT ticket_id, status FROM ticket WHERE order_id = ?", [orderId]);

    res.status(200).json({
      order_id: order.order_id,
      status: order.status,
      total_amount: Number(order.total_amount),
      tickets: ticketRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.put("/tickets/:id", requireAdmin, async (req, res) => {
  const ticketId = req.params.id;

  try {
    const [existingRows] = await pool.query("SELECT * FROM ticket WHERE ticket_id = ?", [ticketId]);
    const existing = (existingRows as Record<string, any>[])[0];
    if (!existing) {
      return res.status(404).json({ error: "ticket not found" });
    }

    const body = req.body ?? {};
    const order_id = body.order_id ?? existing.order_id;
    const event_id = body.event_id ?? existing.event_id;
    const user_id = body.user_id ?? existing.user_id;
    const price = body.price ?? Number(existing.price);
    const status = body.status ?? existing.status;

    if (!Number.isInteger(order_id) || order_id < 1) {
      return badRequest(res, "order_id must be a positive integer");
    }
    if (!Number.isInteger(event_id) || event_id < 1) {
      return badRequest(res, "event_id must be a positive integer");
    }
    if (!Number.isInteger(user_id) || user_id < 1) {
      return badRequest(res, "user_id must be a positive integer");
    }
    if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
      return badRequest(res, "price must be a non-negative number");
    }
    if (!TICKET_STATUSES.includes(status)) {
      return badRequest(res, `status must be one of ${TICKET_STATUSES.join(", ")}`);
    }

    if (body.order_id !== undefined) {
      const [orderRows] = await pool.query("SELECT order_id FROM orders WHERE order_id = ?", [order_id]);
      if (!(orderRows as unknown[])[0]) {
        return badRequest(res, "order_id does not reference an existing order");
      }
    }
    if (body.user_id !== undefined) {
      const [userRows] = await pool.query("SELECT status FROM user WHERE user_id = ?", [user_id]);
      const user = (userRows as { status: string }[])[0];
      if (!user) {
        return badRequest(res, "user_id does not reference an existing user");
      }
      if (user.status === "Suspended") {
        return badRequest(res, "cannot assign a ticket to a Suspended user");
      }
    }
    if (body.event_id !== undefined) {
      const [eventRows] = await pool.query("SELECT status, capacity FROM event WHERE event_id = ?", [event_id]);
      const event = (eventRows as { status: string; capacity: number }[])[0];
      if (!event) {
        return badRequest(res, "event_id does not reference an existing event");
      }
      if (event.status !== "Published") {
        return badRequest(
          res,
          `cannot assign a ticket to an event with status ${event.status}; event must be Published`
        );
      }

      const [countRows] = await pool.query(
        "SELECT COUNT(*) AS sold FROM ticket WHERE event_id = ? AND status != 'Refunded' AND ticket_id != ?",
        [event_id, ticketId]
      );
      const sold = (countRows as { sold: number }[])[0].sold;
      if (sold >= event.capacity) {
        return badRequest(res, "event is at capacity; no more tickets may be sold");
      }
    }

    await pool.query(
      "UPDATE ticket SET order_id=?, event_id=?, user_id=?, price=?, status=? WHERE ticket_id=?",
      [order_id, event_id, user_id, price, status, ticketId]
    );

    res.status(200).json({ ticket_id: ticketId, order_id, event_id, user_id, price, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.post("/venues", requireAdmin, async (req, res) => {
  const { name, capacity, address, city } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return badRequest(res, "name is required");
  }
  if (!Number.isInteger(capacity) || capacity < 0) {
    return badRequest(res, "capacity must be a non-negative integer");
  }
  if (address !== undefined && typeof address !== "string") {
    return badRequest(res, "address must be a string");
  }
  if (city !== undefined && typeof city !== "string") {
    return badRequest(res, "city must be a string");
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO venue (name, capacity, address, city) VALUES (?, ?, ?, ?)",
      [name, capacity, address ?? null, city ?? null]
    );
    const insertId = (result as { insertId: number }).insertId;

    res.status(201).json({ venue_id: insertId, name, capacity, address: address ?? null, city: city ?? null });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return badRequest(res, "a venue with this name, address, and city already exists");
    }
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.put("/venues/:id", requireAdmin, async (req, res) => {
  const venueId = Number(req.params.id);
  if (!Number.isInteger(venueId) || venueId < 1) {
    return badRequest(res, "id must be a positive integer");
  }

  try {
    const [existingRows] = await pool.query("SELECT * FROM venue WHERE venue_id = ?", [venueId]);
    const existing = (existingRows as Record<string, any>[])[0];
    if (!existing) {
      return res.status(404).json({ error: "venue not found" });
    }

    const body = req.body ?? {};
    const name = body.name ?? existing.name;
    const capacity = body.capacity ?? existing.capacity;
    const address = body.address !== undefined ? body.address : existing.address;
    const city = body.city !== undefined ? body.city : existing.city;

    if (typeof name !== "string" || !name.trim()) {
      return badRequest(res, "name is required");
    }
    if (!Number.isInteger(capacity) || capacity < 0) {
      return badRequest(res, "capacity must be a non-negative integer");
    }
    if (address !== null && address !== undefined && typeof address !== "string") {
      return badRequest(res, "address must be a string");
    }
    if (city !== null && city !== undefined && typeof city !== "string") {
      return badRequest(res, "city must be a string");
    }

    await pool.query(
      "UPDATE venue SET name=?, capacity=?, address=?, city=? WHERE venue_id=?",
      [name, capacity, address ?? null, city ?? null, venueId]
    );

    res.status(200).json({ venue_id: venueId, name, capacity, address: address ?? null, city: city ?? null });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return badRequest(res, "a venue with this name, address, and city already exists");
    }
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.post("/categories", requireAdmin, async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return badRequest(res, "name is required");
  }

  try {
    const [result] = await pool.query("INSERT INTO category (name) VALUES (?)", [name]);
    const insertId = (result as { insertId: number }).insertId;
    res.status(201).json({ category_id: insertId, name });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return badRequest(res, "a category with this name already exists");
    }
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.put("/categories/:id", requireAdmin, async (req, res) => {
  const categoryId = Number(req.params.id);
  if (!Number.isInteger(categoryId) || categoryId < 1) {
    return badRequest(res, "id must be a positive integer");
  }

  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return badRequest(res, "name is required");
  }

  try {
    const [result] = await pool.query("UPDATE category SET name=? WHERE category_id=?", [name, categoryId]);
    if ((result as { affectedRows: number }).affectedRows === 0) {
      return res.status(404).json({ error: "category not found" });
    }
    res.status(200).json({ category_id: categoryId, name });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return badRequest(res, "a category with this name already exists");
    }
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`eventify-api listening on port ${PORT}`);
});
