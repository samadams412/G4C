# Phase 1 — Local Docker Compose Wiring

## What was built

A local `docker compose` stack wiring three services on one network (`eventify`):

- **`db`** — `mysql:8.0` (pinned because `db/schema.sql` uses `CHECK` constraints,
  which require 8.0.16+). Named volume `db_data` persists data across restarts.
  Exposes `3306` to the host for local inspection (dev-only; drop the `ports:`
  entry to keep it Docker-network-only). Healthcheck via `mysqladmin ping`.
- **`api`** — minimal Express + TypeScript service with one route, `GET /health`,
  that runs `SELECT 1` against `db` through `mysql2` and returns
  `{ status, db }`. Multi-stage Dockerfile (`deps` → `build` → `run`).
- **`web`** — minimal Next.js (App Router) + TypeScript + Tailwind app. The one
  page (`app/page.tsx`) is a server component that fetches `${API_URL}/health`
  server-side at request time and renders the JSON. Multi-stage Dockerfile using
  Next's `output: "standalone"` build.

`api` waits on `db`'s healthcheck; `web` waits on `api`'s container start.

No API or frontend features were built beyond the health-check wiring — that
was the point of this phase.

## Key decisions

- **DB init script ordering.** MySQL's `docker-entrypoint-initdb.d` runs files
  in filename order, and `ticket` has triggers that must exist before seed data
  inserts tickets (or they silently won't fire). Mounted as:
  `01-schema.sql → 02-triggers.sql → 03-procedures.sql → 04-view.sql → 05-dummy_data.sql`.
  Each is mounted individually from its real source path (`db/schema.sql`,
  `db/automation/*.sql`, `db/analysis/view.sql`, `db/dummy_data.sql`) rather
  than duplicated into one directory.
- **`db/automation/user_lifecycle_demo.sql` and `organizer_lifecycle_demo.sql`
  are excluded from init.** They're self-contained demo scripts (insert →
  mutate → delete) meant to be run manually to illustrate a flow, not fired on
  every container boot.
- **`db/docker-init/02-triggers.sql` is a new, trimmed copy of
  `db/automation/triggers.sql`** containing only the two `CREATE TRIGGER`
  statements. The source file also embeds a demo `INSERT` (test order `5006`)
  that assumes seed data already exists — mounting it directly caused an FK
  error that aborted the rest of MySQL's init chain (procedures, view, and
  dummy data all silently failed to load as a result). The source file is
  untouched; only the init-time copy excludes the demo block.
- **`web` fetches `api` server-side**, not from the browser. Avoids needing
  CORS config on `api` entirely, since the request never leaves the Docker
  network.
- **`web/public/` is an empty directory** (Next's standalone build expects it
  to exist) — added a `.gitkeep` so it's tracked.
- Hand-wrote the `web/` skeleton instead of running `create-next-app`, since
  the scaffolder's interactive prompts aren't viable non-interactively; output
  is equivalent to what it would have generated for this minimal case.

## How it was verified

Ran `docker compose up --build` for real (not assumed):

- All three containers report running; `db` reports `(healthy)`.
- `curl http://localhost:4000/health` → `{"status":"ok","db":"connected"}`.
- `curl http://localhost:3100/` → rendered page contains that same JSON,
  confirming `web → api → db` end-to-end.
- Queried `information_schema` directly inside the `db` container to confirm
  `02`–`04` actually loaded (not just that the container started):
  2 triggers, 1 procedure, 1 view present.
- Had to fully recreate the `db` volume (`docker compose down -v`) once after
  fixing the triggers-init issue, since the first boot had already written a
  partially-initialized database.

## Known gaps / follow-ups

- **Seed data vs. trigger conflict (not fixed, by design — out of scope for a
  wiring-only phase):** `db/dummy_data.sql` aborts partway through inserting
  `ticket` rows. The `check_event_status_before_sale` trigger correctly
  rejects a ticket insert for an event whose status is `Canceled`/`Completed`,
  but `seeds/generate_data*.py` generates ticket rows without checking the
  linked event's status first. Result: `venue` (50), `event` (200),
  `category` (8), `event_category` (243), `orders` (1000), and `user` (500)
  all loaded; `ticket` is empty. Doesn't affect this phase (the health check
  doesn't need rows), but will need fixing — either the generator or the
  seed SQL — before Phase 2 work that queries tickets.
- `MYSQL_USER`/`MYSQL_PASSWORD` (not root) are what `api` connects with; no
  separate least-privilege grants were set up beyond what the official
  `mysql` image creates automatically (full privileges on `MYSQL_DATABASE`).
  Fine for local dev; revisit before anything resembling a shared environment.
- `api`'s `/health` has no automated test; verified manually via `curl` per
  the instructions for this phase. Worth a basic test once real routes exist.
- Dev-only host port mappings (`db:3306`, and the fixed `web`/`api` ports) are
  still in `docker-compose.yml` — intentionally, for local debugging — but
  flagged here as the "remove before anything shared" item called out in the
  task.
- `web`'s host port required bumping from `3000` to `3100` in this
  environment specifically because another local process already had `3000`
  bound — not a conflict in the compose file itself.
