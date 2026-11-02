# Phase 12: Motion pass

Adds motion to the home page stats and the events grid with framer-motion, fixes
a reduced-motion hydration error in the hero, and closes two Phase 11 leftovers.
It adds no images, video or other assets.

This branch is stacked on `auth-migration` (PR #21), which wasn't merged when the
phase started. Step 0 edits `LogoutButton.tsx` as Phase 11 left it.

## Step 0: Phase 11 leftovers

- **`LogoutButton.tsx`:** now `font-heading text-sm font-bold text-on-surface
  hover:text-primary`, the same classes as the Events link beside it in
  `Nav.tsx`. This goes against the README's Public Sans rule for controls, so
  the nav stays consistent until `Nav.tsx` itself is migrated. Nothing else in
  `Nav.tsx` changed.
- **`PurchaseTickets.tsx`:** the quantity select gets `focus:ring-2
  focus:ring-primary`, matching the auth inputs.

## Timing and easing

The design system README has nothing on motion, easing or duration, so the
brief's defaults were used:

| Motion | Duration | Easing |
|---|---|---|
| Card hover lift | 150ms (Tailwind default) | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Card reveal | 400ms, plus 0, 80 or 160ms delay by column | `easeOut` |
| Stat count-up | 1000ms | `easeOut` |
| Hero shapes | 5.5 to 8s loops, a different length per shape | `easeInOut` |

The count-up runs longer than the 300 to 500ms reveal default on purpose.
Counting to 100 in 400ms blurs into a jump, and a full second reads as counting.

## What got animated

### Hero shapes (`HeroShapes.tsx`)

The brief described the shapes as fully static, but they weren't. The component
already gave each shape a slow float of 18px up and 8° of rotation, on its own
5.5 to 8s loop, and skipped it under reduced motion. Sampling computed transforms
1.5s apart confirmed they move in headless Chrome and in your own Chrome, which
reports `prefers-reduced-motion: no-preference`. The loops already fall in the
brief's 4 to 8s ambient range, so the motion itself was left alone.

The component did have a bug. Under reduced motion it passed `animate={undefined}`.
That dropped the `will-change: transform` the server had rendered, and React logged
a prop mismatch on every load. Both branches now animate the same keys, with
`{ y: 0, rotate: 0 }` when motion is reduced, and the warning is gone.

### Stat numbers (`CountUp.tsx`, new)

This is a small `"use client"` component that gets the fetched count as a prop.
`page.tsx` stays a server component, the same pattern `HeroShapes` uses.

- **Trigger:** scroll into view (`useInView`, once), not mount.
  - On desktop the stats are visible at load, so the count starts right away
    either way.
  - On a short phone viewport they're below the hero. A count on mount would
    finish before anyone scrolled to it.
- **Server render:** the visible digits render as `0` and are `aria-hidden`. A
  `sr-only` span carries the real value. Without it, a screen reader that never
  scrolls the stats into view would announce "0 events live now".
- **Updates:** text is written straight to the DOM node from framer's `animate()`,
  so the count doesn't re-render React 60 times a second.

### Event grid (`EventsList.tsx`)

- **Reveal:** each card is wrapped in a `motion.div` that fades in from
  `opacity: 0` and slides up 16px when 20% of it enters the viewport, once.
- **Stagger:** the delay is `(i % 3) * 80ms`, so each row ripples left to right.
  Per-card triggers were chosen over a parent stagger, which fires once for the
  whole grid and would animate offscreen cards that no one sees.
- **Filtering:** keys stay `event_id`, so changing the filter only animates cards
  that weren't rendered before.

### Card hover (`EventCard.tsx`)

**Kept the CSS `hover:-translate-y-1`, not a `whileHover` spring.**

- The lift is 4px, too small for a spring's overshoot to show.
- The CSS transition is 150ms, already inside the micro-interaction range.
- A spring would turn `EventCard` into a client component and attach hover
  listeners to all 100 cards for no visible change.

The card also gets `motion-reduce:transition-none`, so under reduced motion the
lift becomes an instant state change.

## Reduced-motion behavior

| Piece | Motion allowed | Motion reduced |
|---|---|---|
| Hero shapes | Float and rotate | Static |
| Stats | Count up from 0 | Jump straight to the final value |
| Card reveal | Fade and 16px slide | Fade only; the slide finishes instantly |
| Card hover | 150ms lift | Instant lift |

- **Hooks:** the three framer pieces use `useReducedMotion`. The CSS hover uses
  Tailwind's `motion-reduce:` variant.
- **Hydration:** the hook returns `null` on the server and the real preference on
  the client, so it never changes rendered markup or `initial` styles. It only
  affects `animate` targets, transitions and effects, which aren't serialized.
  The hero bug above came from breaking this rule.
- **Live changes:** the hook reads the preference when a component mounts, so
  changing the setting needs a reload to take effect.

## Page transitions: deferred

Not attempted. Neither route works cleanly in Next 14's App Router.

- **Exit animations** (`AnimatePresence` around the route) need the outgoing page
  kept alive during its exit. The App Router swaps it right away. The known
  workaround imports the private `LayoutRouterContext` from
  `next/dist/shared/lib/app-router-context.shared-runtime` to freeze the old
  tree. That is internal API and can break on any Next upgrade.
- **Enter-only animations** through `app/template.tsx` are supported. They would
  put `opacity: 0` on every page's server HTML, so content stays invisible until
  JS hydrates. That costs every route's first paint for a fade.

Worth revisiting if the project moves to a Next version with the View Transitions
API built in.

## Verification

- `npx tsc --noEmit` passes, and `npm run build` passes from a deleted `.next`.
- **Reduced motion, tested by toggling it:** I can't change the Windows animation
  setting, so a script launched a throwaway headless Chrome twice against `next dev`,
  once with `--force-prefers-reduced-motion`. That flag flips the same
  `prefers-reduced-motion` media query the OS setting drives, and the page reported
  `matches: true` with it and `false` without. The results:

  | Check | Normal | Reduced |
  |---|---|---|
  | Hero transforms change over 1.5s | yes | no (`none`) |
  | Stat text during load | 15, then 100 (counting) | 0, then 100 (no in-between values) |
  | Card 31, 150ms after scroll | opacity 0.56, `translateY(7px)` | opacity 0.58, no transform |

- **Hydration:** console errors and warnings were collected on first load of `/`
  and `/events` in both modes. Neither page logged a hydration warning after the
  `HeroShapes` fix. Before the fix, `/` logged the `will-change` mismatch under
  reduced motion.
- **Other console output:**
  - `/favicon.ico` returns 404 on every page. The site has no favicon, which
    predates this phase.
  - framer-motion logs a dev-only notice that reduced motion is on.
- **Visual check in your Chrome:** the shapes float, the counts finish at 100 and 8,
  a mid-scroll screenshot caught the grid partway through its column stagger, and
  "Log out" matches its nav neighbors.

### Not exercised

- **The OS setting itself:** to check it, turn off Settings > Accessibility >
  Visual effects > Animation effects, then reload `/` and `/events`. The hero
  should be still and the cards should fade without sliding.
- **Mobile:** the scroll-triggered count on a phone-height viewport wasn't viewed.
- **Production build:** the hydration check ran on `next dev` only. Dev mode is
  where React reports mismatches in detail.

## Follow-ups and known gaps

- **Bundle size:** `/events` first-load JS went from 97 kB to 136 kB now that
  framer-motion loads there. The home page went from 132 kB to 137 kB, since
  `HeroShapes` already loaded it. Switching to `LazyMotion` with `domAnimation`
  and the `m` component would cut most of that. That matters given the
  load-fast priority.
- **Cards hidden until hydration:** cards render with `opacity: 0` in server HTML,
  so the first row is invisible until JS loads. On a slow connection that delays
  the first visible content on `/events`.
- **Favicon:** none exists, hence the 404.
- **Page transitions:** deferred, see above.
