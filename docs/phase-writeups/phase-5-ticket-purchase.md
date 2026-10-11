# Phase 5: Ticket Purchase

## What was built

A self-service ticket purchase flow on the event detail page, gated behind
login, with honest sold-out handling and an on-page confirmation. No
payment processing — this books a ticket directly, the same way the rest
of this API has no real payment gateway anywhere.

### A new attendee-facing endpoint had to be added

The only existing ticket-write endpoint, `POST /tickets`, is `requireAdmin`,
expects a caller-supplied `order_id` that must already exist, and takes a
client-supplied `price` — none of that is safe to expose to attendees.
Added `POST /tickets/purchase` to `api/src/index.ts`, gated with
`authenticate` (any logged-in user, not just Admin) instead. Request body
is just `{ event_id, quantity }`; `user_id` comes from the JWT, `price` is
computed server-side, `quantity` is capped at 8.

**Overbooking safety**: the whole operation (user status check, capacity
check, order insert, ticket inserts) runs in one DB transaction, and the
event row is read with `SELECT ... FOR UPDATE`. That row lock serializes
concurrent purchase attempts for the same event, so the capacity check
(`COUNT(non-Refunded tickets) + quantity <= capacity`) can't race the way
the existing admin endpoint's count-then-insert does (that one reads the
count outside any lock). Sold-out and insufficient-remaining both return a
clean 400, never a constraint violation.

**Price**: there's no price field on `event` in this schema, only on
`ticket`. The endpoint charges `MIN(price)` among that event's existing
non-Refunded tickets, the same number the event detail page already shows
as the "from $X" price, so what's displayed is exactly what gets charged.
If an event has never sold a ticket, there's no real price to charge, so
the endpoint rejects with "ticket pricing hasn't been set for this event
yet" rather than inventing a number.

### Files added

- `web/app/api/tickets/purchase/route.ts` — proxies to the API, reading the
  httpOnly `session` cookie and forwarding it as `Authorization: Bearer`,
  same pattern as the auth routes.
- `web/app/events/[id]/PurchaseTickets.tsx` — client component: quantity
  selector (1 to `min(8, remaining)`), a disabled "Sold out" state when
  `remaining <= 0` (no selector rendered at all, not just a disabled
  button), a disabled message when no price is set, redirect to
  `/login?next=/events/{id}` on submit if not logged in (reusing the same
  `next` convention `/account`'s middleware uses), and an on-page
  confirmation after a successful purchase.

### Files changed

- `api/src/index.ts` — new `POST /tickets/purchase` endpoint (see above),
  imports `authenticate` from `./auth` (previously only `requireAdmin` was
  imported there).
- `web/app/events/[id]/page.tsx` — now also fetches the session user
  (`getSessionUser()`, already used elsewhere) and computes `remaining`
  (clamped at 0), passing both plus the existing `minPrice` down to
  `<PurchaseTickets>`. Only rendered when `event.status === "Published"`.

## Key decisions

- **Quantity-only selector, no ticket type**: the schema has no
  ticket-type concept, so there's nothing to select beyond how many.
- **Straight to `Purchased`, no reservation step**: this is a one-click
  "buy now," not a cart. Matches the "on-page confirmation is enough, no
  email" framing of the request.
- **Sold-out is a UI state, not an error path**: when there's no capacity
  left, the component never renders a submittable form at all, so there's
  no request to fail. The server still independently enforces it (tested
  below) in case someone calls the API directly.
- **Palette untouched**: violet primary button, teal confirmation border,
  same tokens as the rest of the site.

## Verification

Tested beyond the happy path, against the live stack, per the explicit ask
since this is the one place a bug could let someone overbook:

- **Sold-out, UI level**: used the admin `PUT /events/:id` endpoint to set
  an event's `capacity` equal to its current sold count (22/22). The
  detail page rendered a disabled "Sold out" block with no quantity
  selector or button at all — there was no way to even attempt a request.
- **Sold-out, API level (bypassing the UI)**: `curl`'d
  `POST /tickets/purchase` directly for that same sold-out event with a
  valid logged-in user's token. Got `400 {"error":"this event is sold
  out"}` — the server rejects it independently of whatever the UI shows,
  confirming the capacity check isn't just a client-side nicety.
- **Real purchase**: logged in through the UI, picked an event with 7 of
  114 spots taken, selected 2 tickets, submitted. Got an on-page
  confirmation ("2 tickets booked for $173.96"), and the ticket panel
  updated to "9 of 114 spots taken" via `router.refresh()` without a full
  page reload. Cross-checked `GET /tickets?event_id=X` directly afterward:
  order 6001, two `Purchased` tickets at $86.98 each (the event's min
  price), confirming the purchase actually persisted, not just a UI
  illusion.
- Restored the test event's capacity back to its original value afterward
  so the dev DB wasn't left in an artificially altered state.
- `docker compose up -d --build` — clean build.
- All new UI/API copy was checked against the humanizer skill; two dash
  constructions ("You're in — N tickets...", "Buy N — $X.XX") were
  rewritten to drop the dash as a sentence connector.

## Known gaps / follow-ups

- No real payment processing anywhere in this API, purchase included —
  this books inventory, it doesn't charge a card.
- No way to cancel/refund a self-purchased ticket from the UI (the
  `Refunded` status exists in the schema and admin tooling, but there's no
  attendee-facing path to it).
- `/account` still doesn't list a user's past purchases; it's still the
  placeholder page from Phase 4.
