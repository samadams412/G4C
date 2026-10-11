# Phase 3: Events List Page

## What was built

A public `/events` page in the Next.js web app that lists published events
and lets visitors filter them by category client-side. Scope was limited to
the list view only — no event detail page and no write flow (ticket
purchase, event creation) were touched.

Files added:
- `web/lib/api.ts` — typed fetch helpers (`getEvents`, `getCategories`)
  against the API service.
- `web/app/events/page.tsx` — server component, fetches events + categories
  in parallel, renders the error/empty states and `<EventsList>`.
- `web/app/events/loading.tsx` — skeleton shown by Next.js while the server
  component's fetch is in flight.
- `web/app/events/EventsList.tsx` — client component holding the selected
  category filter and the filtered grid.
- `web/app/events/EventCard.tsx` — presentational card with category
  badges and formatted date.

Files changed:
- `web/app/layout.tsx`, `web/tailwind.config.js` — added the Fredoka/Nunito
  font pairing and a warm orange/blue/cream color palette.
- `api/src/index.ts` — `GET /events` now returns a `categories` array per
  event (previously only `GET /events/:id` did this).

## Key decisions

- **Visual direction**: a light, festival-energy look (claymorphism-style
  cards, chunky borders, warm cream background, vivid per-category badge
  colors) picked via the UI/UX design-system skill, since the repo has no
  `frontend-design` skill installed. Full rationale and token choices came
  from that skill's `--design-system` search, not improvised.
- **Category filtering is client-side**, confirmed with the user: all
  published events are fetched once and filtered in React state rather
  than re-querying the API's `?category=` param on every click. This
  avoids a request on every filter click; the dataset size at this stage
  doesn't justify API-side filtering.
- **API change**: client-side filtering needs each event's categories in
  the list payload, which `GET /events` didn't return. Rather than adding
  a new endpoint, the existing list query got one extra lookup query
  (events already fetched → fetch their `event_category` rows → attach),
  mirroring the join `GET /events/:id` already does. This was the smallest
  change that made the already-agreed filtering approach work.
- **Loading state** is handled via Next.js's `loading.tsx` convention
  (streamed while the server component's data fetch runs) rather than a
  client-side spinner, since the event list itself is server-fetched.

## Verification

- `docker compose up -d --build` — all three services (`db`, `api`, `web`)
  started and passed health checks.
- `curl http://localhost:4000/events?status=Published&pageSize=100` and
  `/categories` returned real seeded rows, each event including its
  `categories` array.
- `curl http://localhost:3100/events` (the web container's mapped port,
  per `.env`) returned HTTP 200 with real seeded event titles and category
  names in the HTML (e.g. "Grass-roots actuating structure Festival",
  "Sport", "Comedy") — confirmed the page renders live data through the
  API, not a placeholder.
- Stack was torn down with `docker compose down` after verification.
- Did not verify in an actual browser (no screenshot/visual check of
  hover states, badge color distribution, or responsive breakpoints) —
  only HTTP-level rendering was checked.

## Known gaps / follow-ups

- No automated test coverage added for `EventsList`'s filter logic.
- Badge colors are derived from a simple character-sum hash of the
  category name, so two categories could collide on the same color; not
  addressed since the category set is small and fixed.
- The event detail page and any write/ticketing flow are explicitly out of
  scope for this phase.

## Follow-up pass: color system + seed data

Two issues were raised after the initial build and fixed in the same phase.

### Color system was effectively monochrome

The first pass's palette (`primary`/`secondary` both orange tints, `ink` also
orange-tinted) meant only the category pills read as colorful; header, CTA,
and cards were all one hue with varying lightness.

Reworked `web/tailwind.config.js` to six distinct vivid tokens (`coral`,
`pink`, `teal`, `violet`, `sky`, `amber`) plus a neutral `ink`, with each
assigned to a specific, non-overlapping use:
- Hero heading accent word → `pink`
- A six-segment "bunting" divider stripe under the hero → all six colors
- Active filter pill → `violet` (distinct from both the brand color and the
  category badge palette)
- Event card border/shadow → rotates through all six colors by grid index,
  so the card grid itself reads as multi-color, not uniformly orange
- Card date text → `sky`
- Empty/error state border → `amber`
- Category badges → left untouched; they already had their own independent
  6-color hash-based palette

Palette and the per-element assignment were presented to the user before any
component file was touched, per their request.

### Seed data titles/descriptions were Faker jargon

`seeds/generate_data_v3.py` used `fake.catch_phrase() + ' Festival'` for
every event title (producing strings like "Grass-roots actuating structure
Festival") and one near-identical description template per category with
only the title spliced in.

Replaced both:
- `generate_title()` builds category-aware titles from curated word lists
  (e.g. music events combine an adjective + noun "band name" with a suffix
  like "Live" or "World Tour Stop"; workshops pick from a curated skill
  list; comedy nights use a real-sounding last name). No more
  `catch_phrase()`/`bs()`-style generators.
- `generate_description()` picks from 5 structural templates and a
  category-specific flavor sentence (2 options per category), filling in
  the actual venue name, city, and formatted date for that event — no
  boilerplate prefix repeated verbatim across events.
- The event's "primary" category (used for the title) is now the same one
  guaranteed to appear in its `event_category` rows, so a Tech Conference
  event is actually tagged Tech Conference.

### Verification

- Ran `seeds/generate_data_v3.py`; caught and fixed a `StopIteration` bug in
  venue lookup (a generator re-evaluated `random.choice` per item instead of
  once) and confirmed the SQL file write still succeeds despite a pre-existing,
  out-of-scope `UnicodeEncodeError` on the final `✅` success `print()` under
  Windows' default console encoding (left unfixed — not part of this file's
  requested scope).
- Spot-checked 15 random generated title/description pairs — all read
  naturally with correct venue/city/date substitution, no nonsense or
  verbatim-repeated boilerplate.
- Reseeded the dev DB (`docker compose down -v` to drop the MySQL volume so
  `docker-entrypoint-initdb.d` reruns, then `docker compose up -d --build`)
  and confirmed via `curl` that the API now serves the new titles.
- Took a Chrome screenshot of `/events` and of the Tech Conference filter
  applied: confirmed the page reads as genuinely multi-color (pink/violet
  hero, six-color bunting stripe, violet active pill, cards rotating
  through six different border colors) rather than one brand color with
  accents.
- Stack torn down with `docker compose down` (volume preserved this time)
  after verification.

## Follow-up: event detail page

Added `/events/[id]`, linked from each `EventCard` on the browse page, with
no auth or booking flow (explicitly deferred).

Files added:
- `web/app/events/[id]/page.tsx` — server component. Fetches `GET
  /events/:id` (title, full description, venue, categories, status) and
  `GET /tickets?event_id=X` (for price range and spots-taken) in parallel-ish
  (sequential awaits, event first since tickets depend on a valid id).
  Calls `notFound()` for an invalid or missing id.
- `web/app/events/[id]/loading.tsx`, `web/app/events/[id]/not-found.tsx` —
  skeleton and 404 state, same visual language as the rest of the site.
- `web/lib/colors.ts` — the badge/card-accent color logic, previously
  inlined in `EventCard.tsx`, extracted so the list and detail pages share
  one source of truth instead of drifting.

Files changed:
- `web/app/events/EventCard.tsx` — now imports from `lib/colors.ts` and
  wraps each card in a `next/link` to `/events/{id}`.
- `web/lib/api.ts` — added `getEvent()` and `getEventTickets()`, plus
  `EventDetail`/`Venue`/`Ticket` types.
- `api/src/index.ts` — `GET /tickets` gained an `event_id` query filter.
  It previously had no way to scope to one event; without it the detail
  page would need to page through the entire ticket table client-side to
  compute a price range. Same validate-then-filter pattern already used
  for `category`/`status` on `GET /events`.

### Key decisions

- **Ticket/pricing info is derived, not stored.** There's no price field on
  `event` — price lives per ticket. The panel shows a min–max price range
  and a sold/capacity count computed from that event's non-Refunded
  tickets, not a single fixed price.
- **Palette reused, not reinvented**, per the request: the bunting-stripe
  divider, violet links, teal/accent card borders (now keyed by the
  event's id via `cardAccentForId` so it's deterministic per event, mirroring
  the index-based rotation on the list page), and category badge colors are
  the same tokens and logic as the browse page.

### A pre-existing seed-data bug blocked verification

While testing, `GET /tickets` returned zero rows for every event. The `db`
container logs showed the dummy-data import failing partway through the
`ticket` INSERT: `Error: Cannot purchase a ticket for an event that is
Canceled or Completed` (a DB trigger). `seeds/generate_data_v3.py`'s ticket-
event pool excluded only `Canceled` events, not `Completed` ones, so the
multi-row INSERT hit a disallowed status and the whole statement rolled
back silently on container init, leaving the `ticket` table empty.

This wasn't something this session introduced, but it directly blocked
verifying the ticket panel, so it was fixed in the same file: both ticket-
event pools (`popular_event_ids` and the general pool) are now built from
`Published` events only, matching what the trigger actually allows.

### Verification

- `docker compose up -d --build` — clean build, no TypeScript errors.
- `curl /events/:id` and `curl /tickets?event_id=X` confirmed real data,
  including the new `event_id` filter working correctly.
- After the ticket-seed fix and a full reseed (`down -v` + `up --build`),
  `GET /tickets` returned 2,045 rows across published events, confirming
  the trigger-driven import failure is resolved.
- Chrome screenshot at desktop width (1568×744, the environment's actual
  window size) of an event with 47 tickets: confirmed title, categories,
  date/venue card, full description, and a real `$20.18–$471.38 per
  ticket` / `34 of 1397 spots taken` panel, all in the shared palette.
- **Mobile-width screenshot was not obtained.** `resize_window` reported
  success but the tab's `window.innerWidth` never changed from 1920 across
  several attempts (new tab, un-maximizing first, toggling DevTools device
  mode) — a tool limitation in this session, not a page issue. The layout
  uses the same `max-w-3xl` + flex-wrap + rounded-card pattern as the list
  page, with no grid breakpoints to break, and that pattern was confirmed
  at real mobile width in the earlier list-page screenshot — but this is
  reasoning from the pattern, not a direct observation of this page.
- All new UI copy was checked against the humanizer skill's AI-tell list;
  no changes were needed.

### Known gaps / follow-ups

- Mobile-width visual verification of this specific page is still
  outstanding (see above).
- No automated tests for the price-range/spots-taken calculation.
- Booking/ticket purchase flow and auth are explicitly out of scope here.
