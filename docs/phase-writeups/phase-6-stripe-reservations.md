# Phase 6: Reservation-Based Purchase Flow with Stripe

## What was built

Replaced the instant-commit ticket purchase in `POST /tickets/purchase` with
a reservation flow backed by a real Stripe PaymentIntent (test mode), and
added `POST /webhooks/stripe` to finalize or release the reservation based
on what Stripe reports back.

- `POST /tickets/purchase` now creates a `Pending` order, inserts
  `Reserved` tickets, creates a Stripe PaymentIntent for the computed total,
  and returns the PaymentIntent's `client_secret` for a future frontend to
  confirm payment with.
- `POST /webhooks/stripe` verifies Stripe's signature and handles
  `payment_intent.succeeded` (finalizes the order to `Completed` and its
  tickets to `Purchased`) and `payment_intent.payment_failed` (releases the
  order to `Refunded` and its tickets to `Refunded`, freeing the spots).
- No frontend changes, per the task — verified entirely via the Stripe CLI
  and direct API calls.

## Schema decision: reused existing status columns, no new table

`ticket.status` already had a `'Reserved'` value in the enum
(`db/schema.sql`) that nothing was writing yet, and `orders.status` already
had `'Pending'`/`'Completed'`/`'Refunded'`. A reservation *is* exactly an
order in `Pending` status with `Reserved` tickets attached — so rather than
add a parallel `reservations` table, two nullable columns were added to
`orders`:

- `stripe_payment_intent_id VARCHAR(255) UNIQUE` — correlates the Stripe
  webhook event back to the order.
- `reservation_expires_at DATETIME` — the reservation's TTL (15 minutes,
  `RESERVATION_TTL_MINUTES` in `api/src/index.ts`).

This kept the existing `ticket`/`orders` relationship and every other
endpoint that already reads `ticket.status` or `orders.status` working
unchanged.

### Expiry handling (no cron job)

Rather than a background job to sweep expired reservations, the capacity
count query in `/tickets/purchase` treats an expired `Reserved` ticket as
already free:

```sql
SELECT COUNT(*) AS sold FROM ticket t
JOIN orders o ON o.order_id = t.order_id
WHERE t.event_id = ?
  AND (t.status = 'Purchased' OR (t.status = 'Reserved' AND o.reservation_expires_at > NOW()))
```

So a stuck or abandoned PaymentIntent can never permanently hold a spot —
the next purchase attempt against that event simply doesn't count it. The
rows themselves are left as `Reserved` (shortcut: nothing ever flips them to
an explicit `Expired`/`Refunded` status on timeout — a future cron job that
does that cleanup, and frees the `ticket_id` string for a status-report
query, is the natural next step if stale `Reserved` rows need to be
surfaced in the admin UI).

## Stripe wiring

- `stripe` added as an API dependency (`api/package.json`).
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` added to
  `docker-compose.yml` (api service env) and `.env.example`; real values
  live only in the gitignored `.env`.
- `POST /webhooks/stripe` is registered **before** the global
  `app.use(express.json())` in `api/src/index.ts`, using
  `express.raw({ type: "application/json" })` for that one route — Stripe's
  signature verification needs the raw request body, and the global JSON
  parser would otherwise consume it first.
- PaymentIntents are created with `automatic_payment_methods: { enabled:
  true, allow_redirects: "never" }`. Without this, confirming a PaymentIntent
  via direct API call (no frontend redirect step) fails requiring a
  `return_url`.

## Local webhook testing (Stripe CLI)

```sh
stripe login                     # one-time, or `stripe switch` between accounts/sandboxes
stripe listen --events payment_intent.succeeded,payment_intent.payment_failed \
  --forward-to localhost:4000/webhooks/stripe
```

This prints `Your webhook signing secret is whsec_...` — put that in
`.env` as `STRIPE_WEBHOOK_SECRET` and restart the `api` container so it
picks it up. The CLI forwards real webhook events from whichever
account/sandbox it's currently logged into, so that account must match the
one `STRIPE_SECRET_KEY` belongs to (check with `stripe config --list`), or
the signing secret won't verify events for PaymentIntents the API created.

To drive a PaymentIntent to a terminal state without a frontend, confirm it
directly using one of Stripe's test payment-method tokens — never a raw
card number (Stripe's API rejects raw PANs sent server-side as a PCI-risk
pattern, flagged even in test mode):

```sh
curl https://api.stripe.com/v1/payment_intents/<id>/confirm \
  -u "$STRIPE_SECRET_KEY:" -d "payment_method=pm_card_visa"            # succeeds
curl https://api.stripe.com/v1/payment_intents/<id>/confirm \
  -u "$STRIPE_SECRET_KEY:" -d "payment_method=pm_card_chargeDeclined"  # declines
```

## Verification

All three required scenarios run against the dockerized stack
(`docker compose up -d db api`) with `stripe listen` forwarding to it:

1. **Successful test card → webhook → real ticket.** `POST
   /tickets/purchase` created order 6005 (`Pending`, `Reserved` ticket).
   Confirmed the PaymentIntent with `pm_card_visa` → `succeeded`. CLI
   forwarded `payment_intent.succeeded`, API responded 200. DB: order 6005
   → `Completed`, ticket → `Purchased`.
2. **Declined card → reservation released, spot freed.** Order 6006
   created the same way. Confirmed with `pm_card_chargeDeclined` →
   `card_declined`. CLI forwarded `payment_intent.payment_failed`, API
   responded 200. DB: order 6006 → `Refunded`, ticket → `Refunded` (excluded
   from the capacity count, so the spot is immediately purchasable again).
3. **Sold-out event rejects before Stripe is ever called.** Set event
   1002's capacity to 0, called `/tickets/purchase` → `400 {"error":"this
   event is sold out"}` with no PaymentIntent created (nothing appears in
   the `stripe listen` log for that request). Capacity restored afterward.

The existing dev DB volume predates this schema change (init scripts only
run against an empty data directory), so the two new `orders` columns were
applied in place with `ALTER TABLE` against the running container rather
than recreating the volume — `db/schema.sql` is the source of truth for any
fresh environment.

## Known gaps / follow-ups

- No cron/scheduled job to sweep expired `Reserved` rows into an explicit
  terminal status — they're just excluded from capacity counts. Fine for
  now per the task scope; revisit if an admin view needs to show "expired"
  distinctly from "pending."
- No frontend integration (`client_secret` is returned but nothing consumes
  it yet) — out of scope for this phase.
- Webhook idempotency is handled by checking `order.status === 'Pending'`
  before applying a webhook's effect, under a `SELECT ... FOR UPDATE` lock,
  so a redelivered event is a no-op. Not load-tested beyond this.

## Addendum: the TTL expiry path was actually exercised, not just reasoned about

The expiry logic above was originally verified only by reading the capacity
query. It was later re-verified by actually forcing an expiry: temporarily
dropped `RESERVATION_TTL_MINUTES` to 12 (seconds, with the SQL interval unit
switched to `SECOND` for the duration of the test) and pinned an event's
capacity so exactly one spot was free, then:

1. Created a reservation and left it unpaid (the Payment Element step,
   abandoned). Confirmed via direct queries that the event correctly showed
   sold out while the reservation was live, then — after waiting past the
   12-second TTL — the capacity query excluded it and the spot showed free
   again, even though the order row itself just sits there as `Pending`
   forever (nothing ever flips its status on expiry; the TTL is purely a
   counting rule in the capacity query, not a state transition).
2. Confirmed a fresh reservation could immediately claim that exact freed
   spot, and completed its payment for real, legitimately reselling it.
3. Then confirmed the original, abandoned PaymentIntent anyway (Stripe
   doesn't know or care that our app considers it expired) to see what the
   webhook would do with a late `payment_intent.succeeded` for a spot that
   had already been resold.

Step 3 reproduced a real double-sell: the original (unfixed) webhook
handler only checked `order.status === 'Pending'` — which stayed true
forever, since nothing ever changes it on expiry — so it finalized the
stale order to `Completed`/`Purchased` anyway, pushing the event's active
ticket count one over its pinned capacity.

Fixed by having the webhook also check whether the order's
`reservation_expires_at` had already passed at the moment a
`payment_intent.succeeded` event arrives. If so, it no longer finalizes the
order — it issues a real Stripe refund (`stripe.refunds.create`) for the
payment, marks the order and ticket `Refunded`, and logs the conflict,
rather than silently granting a ticket against a spot that's already gone.
Re-ran the exact same repro against the fix: the stale PaymentIntent's late
success now ends in a refund (confirmed via Stripe's own refunds API, not
just the DB) and `Refunded` order/ticket status, while the event's active
ticket count stayed exactly at its pinned capacity — no oversell.

`RESERVATION_TTL_MINUTES` and the SQL interval unit were reverted back to
15/`MINUTE` afterward; the expiry-aware webhook check is permanent.
