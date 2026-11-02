# Phase 9: Design system foundation (terracotta M3 tokens)

Replaces the ad hoc rainbow palette and Fredoka/Nunito with the Material
Design 3 color roles and Fraunces/Public Sans type pairing defined in
`docs/eventify-design-system/`. Light values only; dark mode is a later phase.

## Still on the old palette (Phase 10+)

`app/events/**`, `app/login/**`, `app/register/**` and `app/account/**` still
run the old palette, apart from the card and chip lines listed below.
`app/LogoutButton.tsx` does too: it renders inside the Nav but was not on this
phase's file list, so its `text-ink hover:text-violet` remains.

These pages do pick up the new fonts and the new `background` color from
`<body>`, but each sets its own `bg-cream` on `<main>`, so the old cream still
shows there.

## What changed

- **`web/tailwind.config.js`**: all 37 M3 role tokens added. Fonts now point at
  `--font-display` and `--font-sans`, with the fallbacks from `tokens.json`.
- **`web/lib/colors.ts`**: deleted. Its classes are inlined at the call sites.
- **`web/app/layout.tsx`**: Fraunces (500/600/700) as `--font-display`, Public
  Sans (400/500/600) as `--font-sans`, and `bg-background text-on-background`
  on `<body>`.
- **`web/app/Nav.tsx`**: the swaps from the brief, plus `text-ink` to
  `text-on-surface` and `bg-white` to `bg-surface-container-low`, which
  `tokens.json` names as the nav bar background.
- **`web/app/page.tsx`**: hero and stat cards restyled. Both stat cards use
  `bg-surface-container` with no border or shadow, and both numbers use
  `text-primary`.
- **`web/app/HeroShapes.tsx`**: six unrelated hues replaced by the three
  `*-container` roles, assigned so no two neighbouring shapes match. The
  containers suit the 30% opacity the shapes render at; the base roles turn
  muddy brown at that opacity.
- **`web/app/events/EventCard.tsx`, `web/app/events/[id]/page.tsx`**: chips use
  `bg-secondary-container text-on-secondary-container`, cards and the detail
  info panel use `bg-surface-container`.
- **`web/app/events/EventsList.tsx`**: stopped passing `accentIndex`, which no
  longer does anything. This is the only change in that file; it never imported
  from `lib/colors.ts` directly.

## Departures from the brief

Three steps could not be followed as written. Each was tested by running the
Tailwind CLI (3.4.19) against the real config.

### 1. Token keys are kebab-case, not camelCase

The brief asked for camelCase keys so that classes read `bg-primary-container`.
Tailwind uses keys verbatim: `primaryContainer` generates
`bg-primaryContainer`, and `bg-primary-container` generates nothing. The class
names were the goal and appear throughout the brief, so the keys are quoted
kebab-case and match the names in `tokens.json`.

### 2. The legacy colors stay in the config, marked TODO: Phase 10

The brief asked to replace the `colors` block entirely, and also said the
out-of-scope pages should keep running the old palette. Both can't hold.
Without the legacy keys `bg-violet`, `text-ink`, `bg-cream` and `bg-amber`
generate no CSS at all, so the pages would not fall back to anything. The
`bg-violet text-white` submit buttons on login, register and checkout would
become white text on a white card, which breaks sign-in and payment.

The eight legacy keys are therefore in a separate block at the end of `colors`.
Delete that block when Phase 10 finishes migrating those files.

### 3. `lib/colors.ts` was deleted, not reduced to fixed exports

`tailwind.config.js` only scans `./app/**`, so classes that exist only in
`lib/` are never generated. Fixed exports there would have produced unstyled
chips and cards. The same applies to the old file: `bg-pink-100` and
`border-sky/30` did not appear in the compiled CSS, so the old category badges
were never actually colored. Inlining avoids the problem without widening the
`content` globs.

## Why the per-category randomization was removed

`badgeColorFor` and `cardAccentFor` assigned colors by hashing a string or by
list position. The color carried no meaning: it did not identify a category
consistently in a way users could learn, and it is the "rainbow of unrelated
colors" the design system exists to replace. The brand book gives each job one
role: category chips always use `secondary-container`, and depth comes from
surface tone (`surface-container`) instead of colored borders and shadows.
Reserving color for roles also leaves `tertiary` free to mean urgency and
`error` to mean sold out in later phases.

## Verification

- `npm run build` in `web/` passes, including from a deleted `.next`, and
  `npx tsc --noEmit` passes.
- `web/` has no `lint` script, so no separate lint ran.
- All 37 tokens were compared by script against the light values in
  `tokens.json`, with no mismatches.
- The compiled CSS contains the new classes and the legacy ones, and no longer
  references Fredoka or Nunito.
- `next dev` with `API_URL` pointed at the Docker API: `/`, `/login`,
  `/register`, `/events` and `/events/1144` all returned 200. The home page
  showed real stats (100 events, 8 categories), `/events` rendered 100 cards on
  `bg-surface-container` with none using the old border, and the home page HTML
  had no old-palette classes.
- HTTP and HTML checks only. Nothing was checked visually in a browser.

### Intermittent build failure

The first `npm run build` failed in `next/font` with `TypeError: Cannot read
properties of null (reading '1')` while loading Fraunces. It did not recur in
three later builds, two of them from a deleted `.next`, and Next's own font
modules resolved valid `.woff2` URLs for both fonts. The cause was not found.
It looks like a transient bad response from Google Fonts, but that is
unconfirmed. If CI fails with this error, rerun it before investigating.

## What should look different

- **Everywhere:** Fraunces serif on headings, and Public Sans on body text.
- **Nav:** soft peach bar instead of white, terracotta wordmark, and terracotta
  Log in, Register and avatar in place of orange and violet.
- **Home:** warm peach-white page, brown-toned headline, "favorite" and the
  Browse Events button in terracotta, and hero shapes in orange, amber and
  peach. The stat cards are flat peach panels with matching terracotta numbers.
- **`/events`:** flat peach cards with peach category chips. Filter buttons,
  heading and bunting stay in the old colors, so this page will look mixed.
- **Event detail:** the same flat info panel and chips; the Tickets panel and
  buttons stay old.
- **Login, register, account:** new fonts only.

## Follow-ups and known gaps

- **Phase 10:** migrate the listed files, then delete the legacy color block.
- **Stripe:** `PurchaseTickets.tsx` hard-codes the old palette in
  `STRIPE_APPEARANCE` and still references the renamed `--font-body`. Update
  both in Phase 10. Stripe renders in its own iframe, so the checkout's font
  is worth checking at that point.
- **`font-heading` on controls:** the brand book puts buttons, labels and nav
  links in Public Sans, but they keep `font-heading` (now serif) because this
  phase only asked for color swaps and specified the logo stays on it.
- **Radius and spacing:** the tokens were not added. Cards and buttons keep
  `rounded-3xl` and `rounded-full`, where the brand book says 12px and 8px.
- **Type scale:** the M3 type tokens were not added to Tailwind.
- **Untracked docs:** `docs/eventify-design-system/` and
  `docs/eventify-mockups/` are not committed by this PR, though the config
  comment and this write-up point to them.
