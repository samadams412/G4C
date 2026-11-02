# Phase 11: Auth migration and legacy palette removal

Moves login, register, account and `LogoutButton.tsx` onto the design tokens,
along with the three `events` files Phase 10 left behind. The legacy color block
is gone from `web/tailwind.config.js`: `cream`, `ink`, `coral`, `pink`, `teal`,
`violet`, `sky` and `amber`, plus the TODO above them. Nothing in `app/` uses them
any more. Light values only.

## What changed

| File | Change |
|---|---|
| `web/app/login/page.tsx` | `bg-cream` to `bg-background` |
| `web/app/login/LoginForm.tsx` | Heading, form card, error, labels, inputs, submit, footer line and link moved to tokens |
| `web/app/register/page.tsx` | Same as `LoginForm.tsx`, plus `min-w-0` on the name labels (see Layout fix) |
| `web/app/account/page.tsx` | Page background, heading and placeholder card moved to tokens |
| `web/app/LogoutButton.tsx` | `text-label-large text-on-surface hover:text-primary`; `font-heading` removed |
| `web/app/events/loading.tsx` | Skeleton moved to tokens, matching the real grid |
| `web/app/events/[id]/loading.tsx` | Skeleton moved to tokens, matching the info card and Tickets panel |
| `web/app/events/[id]/not-found.tsx` | Uses the Phase 10 empty state; back link matches the detail page |
| `web/tailwind.config.js` | Legacy color block and TODO deleted |

The three `events` files weren't in the brief's Step 1 list. They had to move
because deleting the block would have left them with no background or color.
Phase 10 had already queued them for this phase.

## Role mapping

Reused Phase 10's class strings wherever the job was the same.

| Job | Role |
|---|---|
| Page shell | `bg-background` |
| Page h1 | `font-heading text-headline-large text-on-background` |
| Form card | `bg-surface-container`, `radius-md`, no border |
| Labels | `text-label-large text-on-surface` |
| Text inputs | 2px `border-outline`, `surface-container-lowest`, `radius-sm`, `focus:border-primary`, 2px `focus:ring-primary` |
| Submit | `primary` / `on-primary`, `text-label-large`, `radius-sm` |
| Inline error | `error-container` / `on-error-container`, `radius-sm` |
| Footer line | `text-body-medium text-on-surface-variant` |
| Footer link, not-found back link | `text-label-large text-primary` |
| Account placeholder, not-found message | `surface-container-low`, `on-surface-variant`, no border |
| Skeleton bars and cards | `surface-container`; Tickets panel skeleton uses `surface-container-high` at `radius-lg` |

### Calls the brief left open

- **Form card:** no border, not `outline-variant`. The README says tone replaces
  colored card borders, and the card separates well from the background.
- **Input border:** `outline`, not the `outline-variant` the brief suggested. No
  slate classes remain in these files.
  - The README says "input borders use `outline`", and Phase 10's quantity select
    already does.
  - `outline-variant` is 1.84:1 against `surface-container`, below the 3:1 a control
    boundary needs. `outline` is 3.68:1.
- **Focus ring:** added, and not in the brief. `outline` to `primary` is only a
  1.51:1 change, so a border color change alone barely showed. The 2px ring adds a
  thickness change, and focus is obvious in Chrome.
- **Button radius:** pills became `radius-sm`, which the README assigns to buttons
  and matches Phase 10's buttons.
- **`font-heading`:** kept on the three h1s only. Everything else inherits Public
  Sans from `<body>`, confirmed from the computed style on the register submit.

### Layout fix

The name fields on `/register` overflowed the card's content edge by about 8px.
The bug predates this phase. The `flex-1` labels have `min-width: auto`, so they
couldn't shrink below the input's intrinsic width. `min-w-0` on both labels fixes it.
All four inputs now end at the content edge, with no horizontal page scroll.

## Legacy block removal

- **Source:** a whole-word grep for the eight names across `web/app`, `web/lib` and
  `tailwind.config.js` returns zero matches. A check for interpolated class names
  (`bg-${...}`) also returns none.
- **Compiled CSS:** a script compared every class in `app/` with the selectors in
  the production build. Of 142 classes, none lack CSS. No legacy selectors remain,
  and none of the eight legacy hex values appear.
- **Default palette:** removing `pink`, `teal`, `violet`, `sky` and `amber` from
  `extend` brings Tailwind's default shade scales back, so `bg-violet-500` is valid
  again while bare `bg-violet` is not. Nothing uses either. `cream`, `ink` and
  `coral` have no default and are simply gone.

## Verification

- `npx tsc --noEmit` passes, and `npm run build` passes from a deleted `.next`. Both
  ran on the final code.
- `next dev` on port 3200 against the Docker API, checked in Chrome at desktop width:
  - `/login`, `/register` and `/account` match the migrated site.
  - Logout hover goes to `primary`, and the input focus ring shows.
  - `/events/99999999` renders the migrated not-found page.
  - A wrong password shows the `error-container` alert.
  - Register landed on `/events` logged in, and `/account` greeted the new user.
  - Log out worked, and login through `/login?next=/account` redirected to `/account`.
  - No console errors or exceptions were reported on the last page, but tracking
    only started at that point, so this doesn't cover the whole session.
- Text pairs computed against WCAG AA. The lowest is `on-error-container` on
  `error-container` at 4.54:1, the same pair Phase 10 reported.

### Test data

The flow used a throwaway user (`phase11-throwaway@example.test`, `user_id` 1005)
in the local db. It had no orders, tickets or events, and it was deleted by exact
email afterwards.

| | Users | Max `user_id` | Orders | Tickets |
|---|---|---|---|---|
| Before | 506 | 1003 | 1018 | 2073 |
| After | 506 | 1003 | 1018 | 2073 |

Two side effects remain:

- Chrome shares cookies across localhost ports, so this test logged the `sam` session
  out on localhost. That account needs to log in again.
- The `user` table's auto-increment moved on, so the next new user gets an id above
  1005. This is harmless.

### Not exercised

- The loading skeletons flash too quickly to capture. Their exact class strings
  were rendered on the live page instead, which proves the styling and not the
  route transition. Only the `/events/[id]` skeleton's two lower blocks and the
  `/events` skeleton's bar and cards were rendered.
- The mobile layout wasn't viewed.
- The register error messages (duplicate email, API password error) weren't
  triggered. They use the same class string as the login error.
- The Docker `web` container on port 3100 still runs the old image. Rebuild it with
  `up -d --build web` to see these pages there.

## Follow-ups and known gaps

- **Quantity select focus:** `PurchaseTickets.tsx` has the same weak focus change
  the auth inputs had. It needs the same `focus:ring-2 focus:ring-primary`.
- **Nav font mismatch:** `LogoutButton` is now Public Sans, while its neighbors in
  `Nav.tsx` are still `font-heading text-sm font-bold`. "Log out" looks lighter than
  "Events" and the user name beside it. `Nav.tsx` wasn't in scope. Moving its links
  and the Register pill to `font-body` would resolve it, along with the home page
  gap Phase 10 listed.
- **Nav height:** the bar is about 7px taller logged out than logged in, because of
  the Register pill. This predates the phase.
- **Inline links** are told apart from nearby text by color alone, as they were before.
- **CI font failure:** the intermittent `next/font` failure from Phase 10 is still
  unexplained.
