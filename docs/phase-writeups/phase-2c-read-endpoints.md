# Phase 2c — Read-only API endpoints

## What was built
Added public, read-only GET endpoints to `api/src/index.ts`:

- `GET /events` — filterable by `category` (category_id), `status`
  (must be one of Draft/Published/Completed/Canceled), `from`/`to`
  (date range on `start_time`). Paginated via `page`/`pageSize`
  (default 1/20, max pageSize 100). Returns `{ data, page, pageSize, total }`.
- `GET /events/:id` — single event with its `venue` and `categories`
  joined in.
- `GET /venues`, `GET /venues/:id`
- `GET /categories`
- `GET /tickets` — simple paginated listing, no admin gate (per task
  instructions — read-only ticket data isn't considered sensitive here).
- A request logger (`method path timestamp`) was added ahead of all
  routes.
- All params are validated before hitting the DB; invalid input returns
  `400 { error: "..." }`. Missing resources return `404 { error: "..." }`.
  Unhandled DB errors return `500 { error: "internal error" }`.

## Key decisions
- Kept everything in `index.ts` rather than splitting into route
  modules/controllers — the file was already flat (auth.ts is the only
  extracted module) and nine endpoints doesn't justify a new layering
  convention yet.
- No new dependencies — used `mysql2` parameterized queries directly,
  consistent with the existing `/health` and `auth.ts` code.
- `category` filter on `/events` uses a `event_id IN (SELECT ...)`
  subquery against `event_category` rather than a join, to avoid
  duplicate rows when an event has multiple categories.
- Did not touch `auth.ts`, `/auth/login`, or `/admin/ping` — out of
  scope per task instructions.

## Verification
Ran the full stack with `docker compose up -d --build` against the real
seeded data (`db/dummy_data.sql`, 200 events) and curled every endpoint:

- `/health` → `{"status":"ok","db":"connected"}`
- `/categories` → 8 seeded categories
- `/venues`, `/venues/101` → real seeded venue rows
- `/venues/999999` → 404
- `/events?page=1&pageSize=2` → 2 rows, `total: 200`
- `/events?status=Published&category=1&pageSize=2` → 18 matching rows
- `/events/1138` → event with nested `venue` object and `categories`
  array populated from joins
- `/events/999999` → 404
- `/events?status=bogus` → 400 with valid-values message
- `/events/abc` → 400
- `/events?from=notadate` → 400
- `/events?from=2026-01-01&to=2026-02-01` → correctly bounded results
- `/tickets?page=1&pageSize=3` → `{"data":[],...,"total":0}` — correct;
  `db/dummy_data.sql` seeds no `orders`/`ticket` rows, so this is an
  existing data gap, not an endpoint bug.
- API container logs confirmed the request logger fires for every call
  above.

Stack was torn down afterward (`docker compose down`).

## Known gaps / follow-ups
- No seed data exists for `orders`/`ticket`, so `/tickets` is untested
  against non-empty results. Worth adding ticket/order seed rows in a
  future data pass.
- No automated tests were added — verification was manual curl against
  the dockerized stack. If this endpoint set grows, consider adding
  integration tests.
- Auth/write endpoints were explicitly out of scope and untouched.
