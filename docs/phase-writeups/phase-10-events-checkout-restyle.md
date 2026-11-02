# Phase 10: Events and checkout restyle

Moves the events list, event detail and checkout off the old palette, and adds
the radius, spacing and type tokens that Phase 9 left out. Light values only.

## Still on the old palette

`app/login/**`, `app/register/**`, `app/account/**` and `app/LogoutButton.tsx`,
as planned. The legacy color block stays in `tailwind.config.js` until they move.

Also still old, and not on this phase's file list: `app/events/loading.tsx`,
`app/events/[id]/loading.tsx` and `app/events/[id]/not-found.tsx`. The list was
marked as the only files in scope, so they were left alone, but they sit inside
these pages. Users see a cream and violet skeleton before the new page appears,
and an old-style not-found page.

## What changed

- **`web/tailwind.config.js`**: `fontSize`, `spacing` and `borderRadius` added
  from `tokens.json`. Class names are `text-title-large`, `p-space-16` and
  `rounded-radius-md`. The `colors` block is untouched.
- **`web/app/events/EventCard.tsx`**, **`EventsList.tsx`**, **`page.tsx`**,
  **`[id]/page.tsx`**, **`[id]/PurchaseTickets.tsx`**, **`[id]/CheckoutForm.tsx`**:
  colors, radius, type and off-scale spacing moved to tokens.
- **Bunting divider**: the local rainbow in both pages is deleted. Each page now
  has one `<hr className="mb-8 border-outline-variant" />`, the token for
  decorative dividers.
- **`font-heading`**: now only on the four real headings (two h1, two h2).
  Controls and labels dropped it and inherit `font-body` from `<body>`, so no
  class was added. Computed styles confirm Public Sans.
- **`docs/eventify-design-system/`, `docs/eventify-mockups/`**: committed, since
  this phase depends on them.

## Departures from the brief

### 1. Stripe font: not `var(--font-sans)`

The brief asked to correct the font var. Renaming it doesn't work: the Payment
Element renders in Stripe's iframe, which can't see this page's CSS variables.
`next/font` also hashes the family name and serves files only to this origin.

Two test Elements were mounted side by side in the browser with the same
appearance. `var(--font-sans), sans-serif` rendered in a Times-style serif.
`"Public Sans"` with a `fonts: [{ cssSrc }]` option on `<Elements>` rendered in
Public Sans, so that is what shipped. The cost is a Google Fonts stylesheet
loaded inside the iframe, separate from the one `next/font` self-hosts.

`STRIPE_APPEARANCE` exists only in `PurchaseTickets.tsx`, not in `CheckoutForm.tsx`
as the brief suggested. `borderRadius` also moved from 12px to 8px, because
`radius-sm` is the token for text fields. The brief didn't list this one.

### 2. "No compiled CSS contains the old classes" can't hold literally

Of the 33 old classes these files used, 12 are gone from the compiled CSS. The
other 20 that matched (`bg-cream`, `text-ink`, `rounded-3xl`, and so on) stay
because out-of-scope files still use them. One more match, `border-teal`, is a
false positive from `border-teal/30`. A script traced each remaining class to
its source files, and none of the six files holds one.

## Decisions where the sources disagree

| Question | `tokens.json` / README | Mockup | Used |
|---|---|---|---|
| Selected filter | `primary-container` | `secondary-container` | `primary-container`. Category chips own `secondary-container`, and each job gets one role |
| Card title | `title-large`, a sans group, though the README also puts event titles in Fraunces | Fraunces, 20/26 | `font-heading text-title-large`: token size, Fraunces, as the brief asked for h2s |
| Tickets h2 | `title-large` | Public Sans, 20/26 | `font-heading text-title-large`, for the same reason |
| Category chip text | `label-large` | 12/16 | `label-medium`. It matches the mockup and the existing size. Filter chips use `label-large` |
| Card and grid spacing | `space-16` | 20px, not a token | `space-16`. Tokens win over off-scale mockup values |

## Role mapping

| Job | Role |
|---|---|
| Selected filter | `primary-container` / `on-primary-container` |
| Unselected filter | transparent, `border-outline`, `on-surface` |
| Primary CTA (Reserve, Pay, Try again) | `primary` / `on-primary` |
| Back link, card date | `primary` |
| Cancel (outlined) | `border-outline`, `secondary` text |
| Empty state | `surface-container-low`, `on-surface-variant`, no border |
| Tickets panel | `surface-container-high`, no border |
| Quantity select | `border-outline`, `surface-container-lowest`, `focus:border-primary` |
| Event status chip | `surface-variant` / `on-surface-variant` |
| Pending | `tertiary-container` / `on-tertiary-container` |
| Sold out, failed, load error, inline errors | `error-container` / `on-error-container` |
| "Sold out" line in the panel | `error` text |
| Done | `surface-container-highest`, 2px `border-primary`, `on-surface` |

- **Pending** uses `tertiary` because it is a time-sensitive, unresolved state.
  **Sold out** uses `error`, since the README forbids repurposing `tertiary` for it.
- **Done** has no role: the system defines no success color. `primary-container`
  (#FF7A34) is close in hue to `error-container` (#F95630), so a confirmation
  would read as an error. The mockup's selected-tier style was used instead,
  which also means "your ticket".
- **Cancel** is not `error`. That role is for cancelling a ticket, and this button
  only leaves the form.

Every text pair above was computed against WCAG AA. The lowest is
`on-error-container` on `error-container` at 4.54:1, which passes but only just.

## Radius and spacing

- `rounded-3xl` became `radius-md` on cards and `radius-lg` on the Tickets panel,
  matching the mockup. Buttons and fields are `radius-sm`, pills are `radius-full`.
- Spacing moved only where the value was off the scale: `p-5` to `p-space-16` (or
  `p-space-24` on the Tickets panel), `gap-5` to `gap-space-16`, `p-10` to
  `p-space-32`.
- The default scale stays where it already equals a token (`gap-2`, `px-4`,
  `py-2`, `mb-6`, `mb-8`, `py-12`, `p-8` and others), as the brief asked. Rewriting
  those would change no pixels. Spacing that matters for layout but has no token,
  like `h-4 w-4` on the spinner and `max-w-*`, also stays.

## Verification

- `npm run build` passes from a deleted `.next`, and `npx tsc --noEmit` passes.
- A script compiled every new class with the real config and compared the emitted
  CSS with `tokens.json`: 33 classes (15 type, 4 radius, 7 spacing checked as both
  padding and gap), no mismatches.
- `next dev` against the Docker API, checked in Chrome:
  - `/events` rendered 100 cards. Computed styles matched the tokens for the
    h1, card, title, filters, grid gap and divider.
  - The Comedy filter left 16 cards, all Comedy, and moved the selected role.
  - `/events/1128` rendered as expected. Reserve mounted the Payment Element,
    which picked up the new colors, 8px radius and Public Sans.
  - Pay with an empty card showed Stripe's errors in `error` color and the inline
    `error-container` message. No charge was attempted. Cancel returned to select.

### Not exercised

- **No real payment ran.** The pending, done, failed and sold-out states weren't
  reached through the flow. Their exact class strings were rendered on the live
  page and looked correct, which proves the styling and not the state transitions.
  Those transitions weren't changed.
- `/events` load-error and empty states, and the mobile layout, weren't viewed.
- The test Reserve left one Pending order with a Reserved ticket on event 1128 in
  the local db, under the `sam` account. The spot is released from availability
  when `reservation_expires_at` passes, but the page's "spots taken" count still
  includes it, because that count only excludes Refunded tickets.

## Follow-ups and known gaps

- **Next phase:** migrate login, register, account and `LogoutButton.tsx`, plus the
  three `events` files above, then delete the legacy color block.
- **Success role:** the design system needs one. The Done mapping is a stand-in.
- **Stripe hex values** are copied from `tokens.json` because the iframe can't read
  Tailwind classes or variables, so they must be updated by hand. Dark mode will
  need the appearance object to change.
- **Home page and Nav** still use `rounded-3xl`, `rounded-full` and `font-heading`
  on controls. They weren't in scope.
- **Mockup structure not ported:** the two-column detail layout, hero image, ticket
  tiers, stepper, progress bar and price on cards. This phase took only the
  mockups' spacing, radius and type.
- **Uneven card heights:** cards in a grid row don't stretch to match, because the
  `Link` wrapper isn't a block. This predates the phase.
- **`tokens.json`** has a typo in the `surface-variant` usage ("dividOpers'"),
  committed as it was.
