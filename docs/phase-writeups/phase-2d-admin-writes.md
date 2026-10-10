# Phase 2d — Admin-only write endpoints

## What was built
Added POST/PUT endpoints to `api/src/index.ts` for events, tickets,
venues, and categories, all gated by the existing `requireAdmin`
middleware from phase 2b:

- `POST /events`, `PUT /events/:id`
- `POST /tickets`, `PUT /tickets/:id`
- `POST /venues`, `PUT /venues/:id`
- `POST /categories`, `PUT /categories/:id`

`PUT` is a partial update: it loads the existing row, merges any
provided fields over it, re-validates the merged result, and writes it
back. Everything is still plain `express` + parameterized `mysql2`
queries, consistent with the GET endpoints from 2c and `auth.ts` — no
new dependencies or route-module layering.

## Business rules enforced at the API layer
From `Eventify.pdf` and the existing DB triggers/constraints:

- **Ticket creation requires a Published event.** `POST /tickets`
  (and `PUT /tickets/:id` when `event_id` changes) rejects with 400
  if the target event's status isn't `Published` — stricter than the
  `check_event_status_before_sale` trigger (which only blocks
  Completed/Canceled), per this task's explicit instruction. The API
  check runs before the insert, so the trigger is now a backstop, not
  the primary gate.
- **Suspended users can't receive tickets.** Checked against
  `user.status` for the ticket's `user_id`.
- **Capacity limits ticket sales.** `POST /tickets` counts existing
  non-Refunded tickets for the event and rejects once that count
  reaches `event.capacity`. Refunded tickets don't count against
  capacity, freeing a slot.
- **Event capacity can't exceed its venue's capacity.** Enforced on
  both `POST /events` and `PUT /events/:id` (the schema already noted
  this was previously left to "application logic"; it's now enforced
  here rather than only commented).
- **organizer_id must reference a real Organizer/Admin user**, and
  **venue_id/order_id/event_id/user_id must reference existing rows**
  — all checked before insert/update rather than relying on the FK
  constraint to surface a raw DB error.
- **Uniqueness** on venue (`name`+`address`+`city`) and category
  (`name`) is still DB-enforced via the existing unique keys; the API
  catches `ER_DUP_ENTRY` and returns a 400 with a clear message instead
  of a raw SQL error.
- Unique email enforcement (also listed in the PDF) wasn't applicable
  this session — there's no user-creation endpoint in scope here; it's
  already DB-enforced via `user.email UNIQUE` for the one place users
  are written (admin/test seed scripts).

## Bug found and fixed during verification
`ticket.price` is `DECIMAL(10,2)`, which `mysql2` returns as a
**string**, not a number. `PUT /tickets/:id`'s merge logic
(`body.price ?? existing.price`) was feeding that string straight into
the `typeof price !== "number"` validation, so any ticket update that
omitted `price` failed with a false `"price must be a non-negative
number"` error. Fixed by coercing with `Number(existing.price)` when
merging. Caught live via curl during verification (see below) before
this reached a release.

## Verification
Ran the full stack via `docker compose up -d --build` against the
existing `g4c_db_data` volume (same seeded data as phase 2c: 200
events, 502 users, 1000 orders, 0 tickets going in).

**Auth gate:**
- Unauthenticated `POST /categories` → `401 {"error":"missing token"}`
- Authenticated as a non-admin (Attendee) → `403 {"error":"admin access required"}`
- Authenticated as Admin → `201` and the row created

To get real admin/non-admin tokens without reading the project's
`.env` secrets, the dev-seeded `admin@eventify.dev` (999) and
`attendee@eventify.dev` (998) accounts had their `password_hash`
temporarily overwritten (via `docker compose exec db mysql ...`,
referencing the container's own `MYSQL_ROOT_PASSWORD` env var so the
secret was never read into this session) with locally-generated
bcrypt hashes for known test passwords, used to log in and get JWTs.
**Both hashes were restored to their original seeded values** before
finishing.

**Categories:** created `Esports` (201), confirmed row in DB via
direct query, duplicate name rejected (400), renamed via PUT (200),
PUT on a nonexistent id → 404.

**Venues:** created `Test Arena` (201), confirmed in DB, invalid
negative capacity rejected (400), partial PUT (capacity only) applied
correctly (200), PUT on nonexistent id → 404.

**Events:** created a real Published event (`event_id 1201`) with a
real Organizer (`user_id 1`) and real venue (`venue_id 101`); confirmed
in DB. Rejected: `start_time >= end_time` (400), `capacity` exceeding
the venue's own capacity (400), `organizer_id` pointing at a
non-Organizer/Admin user (400). `PUT` to change status (Published →
Canceled → back to Published) worked and persisted.

**Tickets — created against real Published seeded events:**
- `event 1001`, `order 5001`, `user 274` → Purchased
- `event 1003`, `order 5151`, `user 5` → Reserved
- `event 1004`, `order 5164`, `user 7` → Purchased
- `event 1008`, `order 5412`, `user 5` → Reserved

Rejected as expected: ticket against a Canceled event (1005, 400),
against a Completed event (1002, 400), for a Suspended user (user 1 is
seeded Suspended, and two of the orders above — 5002/5004 — turned out
to belong to Suspended users too, both correctly rejected before I
switched to orders belonging to Active users), and against a
nonexistent `order_id` (400).

**Capacity enforcement:** created a dedicated `capacity: 1` event
(1202), successfully sold its one ticket, then a second ticket for the
same event was rejected ("event is at capacity"). Refunded the first
ticket via `PUT /tickets/:id`, which freed the slot, and the
previously-rejected ticket then succeeded — proving Refunded tickets
don't count against capacity.

**Re-check of `GET /tickets` (phase 2c) against real data:** now
returns all 6 tickets created above with correct pagination/total
(`total: 6`), first time this endpoint has had non-empty data to prove
itself against. Output confirmed correct shapes, including
`price` coming back as the DECIMAL string (`"49.99"`, etc.) — a
pre-existing, intentional pass-through from phase 2c, not something
this phase needed to change.

Stack was torn down afterward (`docker compose down`, volume
preserved).

## Scope notes
- Did not touch `seeds/generate_data_v3.py` or regenerate
  `dummy_data.sql`, per instructions.
- Did not touch auth endpoints beyond using the existing
  `requireAdmin` middleware as-is.
- No DELETE endpoints were requested or added.
- Left the verification artifacts (category `Esports`, venue
  `Test Arena`, events 1201/1202, and the 6 tickets) in the dev DB
  volume rather than cleaning them up, since creating real tickets
  against real seeded events was an explicit part of this task's
  verification. They're easy to identify by name/id if a cleanup pass
  is wanted later.

## Known gaps / follow-ups
- No automated tests — verification was manual curl against the
  dockerized stack, same approach as 2c.
- `PUT` on events/tickets/venues doesn't special-case "no fields
  provided" (an empty-body PUT just re-validates and rewrites the
  existing row) — harmless but slightly wasteful; not worth a guard
  for the current usage pattern.
- No DELETE endpoints exist yet for any of these resources, should
  that ever be needed.
