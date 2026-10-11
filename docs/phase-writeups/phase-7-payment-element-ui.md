# Phase 7: Stripe Payment Element on the Purchase Form

## What was built

Replaced the purchase form's instant-submit button with a real Stripe
Payment Element, wired to the Phase 6 reservation endpoints
(`POST /tickets/purchase` for the PaymentIntent, `POST /webhooks/stripe` for
finalization):

- Clicking "Reserve" still calls `POST /api/tickets/purchase` (unchanged
  endpoint, now consumed by the frontend for its `client_secret`), which
  creates the `Pending` order / `Reserved` ticket / PaymentIntent.
- The returned `client_secret` mounts a Stripe `<Elements>` + `PaymentElement`
  (`web/app/events/[id]/CheckoutForm.tsx`), themed to the festival palette
  (`web/lib/colors.ts`'s hex values) via Stripe's Appearance API instead of
  the default Stripe blue.
- Submitting confirms the payment client-side with
  `stripe.confirmPayment({ elements, redirect: "if_required" })` — there's no
  frontend return-url flow, matching the API's
  `allow_redirects: "never"` PaymentIntent setting from Phase 6.
- The UI never treats that client-side confirmation as the final word. It
  moves to a "pending" step and polls a new `GET /orders/:id` endpoint
  (`api/src/index.ts`, owner- or admin-scoped) every 1.5s until the backend's
  own order status — set only by `POST /webhooks/stripe` — reaches a
  terminal state: `Completed` shows the success state, `Refunded` shows a
  "spot released, try again" state. A 30s timeout bails back to the
  quantity-select step with an apologetic message rather than hanging
  forever.
- `EventDetailPage`'s "spots taken" count was already driven by live ticket
  rows (`status !== 'Refunded'`), so it updates on `router.refresh()` calls
  after the reservation is created and again after the webhook resolves it —
  no separate capacity-tracking code needed.
- Copy run through the humanizer skill (dropped em dashes and "feel free
  to" from the status messages).

## A real bug found during verification, and the fix

The first browser pass (see Verification below) caught a correctness bug
that the backend-only Phase 6 testing didn't exercise: Stripe's Payment
Element lets a customer retry a *declined* PaymentIntent with a different
card, by design. But `POST /webhooks/stripe` only applies an event's effect
when `order.status === 'Pending'` — and the first
`payment_intent.payment_failed` already flips the order to `Refunded` and
releases the ticket's spot. If the UI let the customer then succeed on a
retry of that same PaymentIntent, Stripe would send `payment_intent.succeeded`
for an order that's no longer `Pending`, and the webhook handler would
silently no-op: **charged customer, no ticket**, with the spot possibly
already resold to someone else in the meantime.

Releasing on the *first* failure (rather than waiting for some truly
terminal PaymentIntent state) is the right call here — the alternative,
letting a late success resurrect an already-released reservation, risks
overselling the event if that freed spot was claimed by another buyer in the
interim. So the fix is on the frontend: `CheckoutForm` now distinguishes
`confirmError.type`. A `validation_error` (incomplete card field — Stripe
never attempted a charge) still lets the user fix the form and resubmit. Any
other error (an actual declined attempt) immediately calls the same
`onSettled()` path the success case uses, which unmounts the Payment Element
and moves to the webhook-polling "pending" step. That PaymentIntent can
never be shown again from this screen, so there's no way to retry it — a
decline always ends in a fresh reservation (new order, new PaymentIntent)
if the customer tries again.

Also fixed in the same pass: the "pending" status message said "Payment
received" unconditionally, which is false on the decline path (no payment
was received — that's the point of polling). Changed to the neutral
"Confirming your payment now."

## Verification

Both passes ran against the dockerized stack (`docker compose up -d db api
web`) with `stripe listen --events payment_intent.succeeded,payment_intent.payment_failed
--forward-to localhost:4000/webhooks/stripe` forwarding real webhooks, using
Claude in Chrome to drive an actual browser against `localhost:3100` logged
in as the seeded `attendee@eventify.dev` user, against event 1002.

**Pass 1 (before the fix above):**
- Success path: clicking Reserve created a `Pending` order + `Reserved`
  ticket immediately (confirmed via DB query) — this is the real reservation
  hold, already correctly counted in "spots taken," not an optimistic
  frontend guess. Paying with Stripe's `4242 4242 4242 4242` test card
  rendered the Payment Element in the festival palette (cream background,
  violet button, ink text), confirmed the webhook landed, and the DB showed
  the order flip to `Completed` / ticket to `Purchased` before the UI showed
  its "confirmed" success state.
- Decline path: submitting `4000 0000 0000 0002` showed Stripe's own
  "declined" message inline, confirmed in the `stripe listen` log that
  `payment_intent.payment_failed` really reached our webhook (not blocked
  client-side), and the DB showed the order flip to `Refunded` / ticket to
  `Refunded`. **But** the UI stayed on the same payment form with the
  decline error, which is what exposed the retry-the-same-PaymentIntent bug
  described above, and the page's "spots taken" count didn't refresh to
  reflect the release.

**Pass 2 (after the fix):** re-ran only the decline path. Reserving created
order 6010 (`Pending`/`Reserved`, spots-taken 26→27). Submitting the decline
card moved the UI immediately to the polling "pending" state with the
Payment Element fully unmounted (no way to retry that PaymentIntent from the
screen). The DB showed order 6010 → `Refunded` / ticket → `Refunded`, and
only then did the UI show the terminal "spot released, try again" state,
with "spots taken" back down to the pre-reservation **26 of 164** — an exact
match, not just "lower." Clicking "Try again" cleanly reset to the
quantity-select step for a new reservation.

## Known gaps / follow-ups

- Clicking "Cancel" on the payment form just returns to the quantity-select
  step locally — it doesn't cancel the PaymentIntent or release the
  reservation early. The spot still frees itself via the existing 15-minute
  TTL from Phase 6. Fine for now; a `POST /orders/:id/cancel` that calls
  `stripe.paymentIntents.cancel` would tighten this if abandoned carts turn
  out to be common.
- The 15-minute reservation TTL itself wasn't exercised in the browser
  (would need a real 15-minute wait); Phase 6's backend-level verification
  already covers the capacity-query side of that logic.
- Claude in Chrome's screenshot/zoom calls intermittently timed out right
  after interacting with the Stripe Payment Element's cross-origin iframe,
  in both verification passes. `get_page_text` and lower-resolution
  screenshots were reliable fallbacks — noted here in case it recurs, but it
  didn't block verification and isn't an application bug.
