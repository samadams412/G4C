# Commands

Local dev reference for Eventify. The EC2 instance is stopped, so local is the
only running environment for now. Production commands are kept in
[section 6](#6-production-reference-ec2-running-only) for when it comes back.

Unless a row says otherwise, commands were run on Windows 11 on 2026-11-01
against a fresh clone, with Docker 29.8, Compose 5.5, Node 24 and Python 3.12.
Anything not run that way is marked **Not run**. Commands work in both
PowerShell and Git Bash unless marked. Run them from the repo root; `cd web; ...`
leaves you in that folder, so `cd ..` before the next one.

## Ports

| Service | Default | Set by | Notes |
|---|---|---|---|
| web (Docker) | `http://localhost:3000` | `WEB_PORT` | Sam's `.env` uses `3100`, see below |
| web (`npm run dev`) | `http://localhost:3000` | `-p` flag | Ignores `WEB_PORT` |
| api | `http://localhost:4000` | `API_PORT` | |
| db, from the host | `localhost:3306` | `DB_HOST_PORT` | From containers it's always `db:3306` |

**Port conflicts on Sam's machine:**

- **3306:** the Windows `MySQL84` service owns this port, so the Docker db isn't
  reachable from the host, and `mysql -h localhost` reaches the wrong server.
  Set `DB_HOST_PORT=3307` if you need host access, such as running the API
  outside Docker. Containers aren't affected.
- **3100:** the `wow-forever-planner` project can also listen here. With both
  running, `localhost:3100` gave Eventify but `127.0.0.1:3100` gave Forevercraft,
  so use `localhost`, or stop the conflict by moving `WEB_PORT`.

## 1. First-time setup

### Required

Needs Docker Desktop running.

| Step | Command | What it does | When |
|---|---|---|---|
| 1 | `git clone https://github.com/samadams412/G4C.git` | Gets the repo | Once |
| 2 | `cp .env.example .env` | Creates the gitignored env file | Once |
| 3 | Edit `.env` | See the list below | Before step 4 |
| 4 | `docker compose up -d --build` | Builds the images, then creates and seeds the db | Once, then see section 2 |
| 5 | Open `http://localhost:4000/health` | Should show `{"status":"ok","db":"connected"}` | To confirm the stack works |

What to change in `.env` before step 4:

- **`MYSQL_*` passwords and `JWT_SECRET`:** any values work locally. The
  `MYSQL_*` values are only applied when the db is first created, so changing
  them later needs a reset (section 2).
- **Stripe keys:** the stack boots with the placeholders, but checkout needs real
  test keys from `dashboard.stripe.com/test/apikeys`.
- **`DB_HOST_PORT` and `WEB_PORT`:** change them if anything else uses those ports.

A fresh db has two logins, both with the password `ChangeMe123!`:
`admin@eventify.dev` and `attendee@eventify.dev`.

### Only if you'll run an app outside Docker

Neither app reads the root `.env` when run outside Docker, so each needs its own
env file. Both are gitignored and neither ends up in the runtime image.

| Command | What it does | When |
|---|---|---|
| `cd web; npm ci` | Installs web dependencies | Before running web outside Docker |
| `cd api; npm ci` | Installs api dependencies | Before running api outside Docker |

Create `web/.env.local`:

```ini
API_URL=http://localhost:4000
# Must match JWT_SECRET in the root .env, or logins won't stick
JWT_SECRET=<same as root .env>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<same as root .env>
```

Create `api/.env.local`:

```ini
PORT=4000
DB_HOST=127.0.0.1
# Must match DB_HOST_PORT in the root .env
DB_PORT=3307
MYSQL_DATABASE=eventify_db
MYSQL_USER=eventify_app
MYSQL_PASSWORD=<same as root .env>
JWT_SECRET=<same as root .env>
STRIPE_SECRET_KEY=<same as root .env>
STRIPE_WEBHOOK_SECRET=<same as root .env>
```

### Only if you'll test checkout or regenerate seed data

| Command | What it does | When |
|---|---|---|
| `stripe login` | Links the Stripe CLI to your test account. **Not run** (already logged in) | Once, before using `stripe listen` |
| `python -m venv .venv` | Creates a Python environment | Before running anything in `seeds/` |
| `.venv\Scripts\Activate.ps1` | Activates it (PowerShell) | Each new terminal that runs seed scripts |
| `pip install -r requirements.txt` | Installs `faker` and `bcrypt` | Once, after creating the venv |

`.venv/` isn't in `.gitignore`, so a new one shows as untracked. Don't commit it.

## 2. Everyday local dev

### Full stack in Docker

| Command | What it does | When |
|---|---|---|
| `docker compose up -d` | Starts everything, using the existing images | Starting a session |
| `docker compose up -d --build web` | Rebuilds web and recreates only its container | **After any code change in `web/`** |
| `docker compose up -d --build api` | The same for api | **After any code change in `api/`** |
| `docker compose stop` | Stops the containers | Ending a session |
| `docker compose down` | Removes the containers and network. Your data stays | When you want a clean slate of containers |

The images contain a copy of the source, with no live reload. `docker compose up -d`
on its own keeps running old code, even if your files have changed.

Containers use `restart: unless-stopped`, so a stack left running comes back when
Docker Desktop starts.

### Hot reload for web

Order matters: the API has to be up first, and `web/.env.local` must exist.

| Order | Command | What it does | When |
|---|---|---|---|
| 1 | `docker compose up -d db api` | Starts the backend | Before step 2 |
| 2 | `cd web; npm run dev` | Serves web at `http://localhost:3000` with hot reload | Day-to-day frontend work |

Without `web/.env.local`, pages still return 200 but silently show `0` events
and an API error, with nothing obvious in the logs.

### Hot reload for api

The Docker db must be reachable from the host, so set `DB_HOST_PORT` to a free
port (`3307` on Sam's machine) and match it in `api/.env.local`. Changing it
keeps your data.

| Order | Command | What it does | When |
|---|---|---|---|
| 1 | `docker compose up -d db` | Starts the db, and applies any `DB_HOST_PORT` change | Before step 3 |
| 2 | `docker compose stop api` | Frees port 4000 if the Docker API is running | Before step 3 |
| 3 | `cd api; npx tsx watch --env-file=.env.local src/index.ts` | Runs the API with reload on save | Day-to-day backend work |

Plain `npm run dev` in `api/` crashes with `JWT_SECRET is required`, because it
doesn't load any env file.

### Stripe webhooks

Needed for any real checkout. Without the listener, payments never finalize:
orders stay `Pending` and the page gives up after 30 seconds. **Partly run:** the
listener connected, but no full purchase was made.

| Order | Command | What it does | When |
|---|---|---|---|
| 1 | `stripe listen --events payment_intent.succeeded,payment_intent.payment_failed --forward-to localhost:4000/webhooks/stripe` | Forwards test events to the local API and prints a `whsec_...` secret. Leave it running | Testing checkout |
| 2 | Put that secret in `.env` as `STRIPE_WEBHOOK_SECRET` | Lets the API verify events | If the secret differs |
| 3 | `docker compose up -d api` | Recreates the API with the new secret | After step 2 |

Check the listener's account matches `STRIPE_SECRET_KEY` with `stripe config --list`.
The output includes key details, so don't paste it anywhere. **Not run** in full.

### Database

Open a mysql shell in the Docker db, for inspecting data. Run here without a
terminal attached; interactive use is **Not run**:

```bash
docker compose exec db sh -c 'exec mysql -uroot -p$MYSQL_ROOT_PASSWORD $MYSQL_DATABASE'
```

Run a one-off query, for quick checks (PowerShell):

```powershell
"select count(*) from event;" | docker compose exec -T db sh -c 'exec mysql -uroot -p$MYSQL_ROOT_PASSWORD $MYSQL_DATABASE'
```

Run a saved SQL file:

```powershell
# PowerShell
Get-Content db/analysis/event_queries.sql -Raw | docker compose exec -T db sh -c 'exec mysql -uroot -p$MYSQL_ROOT_PASSWORD -t $MYSQL_DATABASE'
```

```bash
# Git Bash
docker compose exec -T db sh -c 'exec mysql -uroot -p$MYSQL_ROOT_PASSWORD -t $MYSQL_DATABASE' < db/analysis/event_queries.sql
```

PowerShell 5.1 strips double quotes nested inside `sh -c '...'`, so
`mysql -e "..."` silently returns nothing there. Pipe the query in instead.

**Read a file before running it. Several of them change data, despite the
`analysis` folder name:**

| File | What it does |
|---|---|
| `db/analysis/event_queries.sql`, `user_queries.sql` | Reads only |
| `db/analysis/sample_queries.sql` | **Inserts a user** |
| `db/analysis/ticket_queries.sql` | **Inserts a ticket** |
| `db/analysis/new_queries.sql` | **Fails:** creates a trigger that already exists |
| `db/automation/user_lifecycle_demo.sql`, `organizer_lifecycle_demo.sql` | **Leave rows behind:** 1 extra user and 1 extra event between them, despite being insert-then-delete demos |
| `db/analysis/view.sql`, `db/automation/triggers.sql`, `procedures.sql` | Already loaded at init, so don't rerun them. `triggers.sql` also has a demo insert. **Not run** |

### Reset and reseed

Init SQL only runs when the db volume is empty. Editing `db/schema.sql` or
`db/dummy_data.sql` does nothing to an existing db until you reset it.

| Command | What it does | When |
|---|---|---|
| `docker compose down -v` | **Deletes all local data**, including test orders and registered users | Before reseeding |
| `docker compose up -d` | Recreates the db and reseeds it, about 10 seconds | After `down -v` |
| `python seeds/generate_data_v3.py` | Overwrites `db/dummy_data.sql` with new random data | When you want different seed data, then reset |
| `$env:SEED_ADMIN_PASSWORD='...'; python seeds/seed_admin.py` | Rewrites `01b-seed-admin.sql` with a new hash (PowerShell) | Changing the admin login, then reset |
| `$env:SEED_TEST_USER_PASSWORD='...'; python seeds/seed_test_user.py` | Rewrites `01c-seed-test-user.sql` (PowerShell) | Changing the test login, then reset |

A fresh db has 502 users, 50 venues, 200 events, 8 categories, 1,000 orders and
about 2,045 tickets.

- **Use only `generate_data_v3.py`.** `generate_data_v2.py` writes SQL that no
  longer matches the schema: init fails with `ERROR 1054` and leaves 0 events.
  `generate_data.py` writes to the repo root, which nothing loads.
- **Run seed scripts from the repo root.** Their output paths are relative.
- **Setting `SEED_*_PASSWORD` in `.env` has no effect.** The scripts only read
  shell variables, and fall back to `ChangeMe123!` without saying so.
- These scripts all change tracked files, so review the diff before committing.

## 3. Build and verify

| Command | What it does | When |
|---|---|---|
| `cd web; npm run build` | Production Next.js build, including type checks. Needs internet for Google Fonts | Before opening a PR. This is what CI runs |
| `cd api; npm run build` | Compiles TypeScript to `api/dist/` | Before opening a PR. This is what CI runs |
| `cd web; npx tsc --noEmit` | Type check only | Faster check while working |
| `cd api; npx tsc --noEmit` | Type check only | Faster check while working |

**There's no lint or test command in either project.** `web/` and `api/` have no
`lint` or `test` script, ESLint config, or test files, and `npm run lint` and
`npm test` fail with `Missing script`. CI only runs `npm ci` and `npm run build`
on Node 20, so a passing build is the only automated check. Exercise changes by hand.

Running the built apps:

| Command | What it does | When |
|---|---|---|
| `cd api; node --env-file=.env.local dist/index.js` | Runs the compiled API | Testing the build outside Docker |
| `cd web; npm start` | Serves the web build. It works, but warns that `next start` doesn't support `output: standalone` | Rarely; prefer the next row |
| `docker compose up -d --build web` | Runs web the way production does | Testing a production build |

- `npm run dev` replaces `.next`, so rebuild before `npm start`.
- `node .next/standalone/server.js` didn't start when run directly on Windows.
  The cause wasn't investigated. It runs fine inside the Docker image.
- A build creates `web/next-env.d.ts`, which is untracked and not gitignored.
  Don't commit it.

## 4. Docker commands

| Command | What it does | When |
|---|---|---|
| `docker compose up -d` | Starts everything, building only if an image is missing | Normal start |
| `docker compose up -d --build` | Rebuilds all images, then starts | After changes in both apps |
| `docker compose up -d --build web` | Rebuilds and restarts one service | After a code or `package.json` change |
| `docker compose build --no-cache api` | Rebuilds from scratch, then run `docker compose up -d api` | When a build seems stale |
| `docker compose ps` | Shows containers, health and ports | Checking what's running |
| `docker compose logs -f api` | Follows one service's logs (`web`, `api` or `db`) | Debugging |
| `docker compose logs --tail 50 api` | Shows recent lines and exits | Quick look |
| `docker compose restart api` | Restarts a container with its **existing** config | A stuck service |
| `docker compose up -d api` | Recreates a container if its config or `.env` values changed | **After editing `.env`** |
| `docker compose stop` / `docker compose start` | Stops and restarts containers without removing them | Pausing work |
| `docker compose down` | Removes containers and network, keeps data | Clean slate, keeping data |
| `docker compose down -v` | Also **deletes the db volume** | Reset only |
| `docker compose exec api sh` | Opens a shell in a container. **Not run** interactively | Debugging inside a container |
| `docker compose config` | Prints the final config with `.env` values, **including secrets** | Debugging env problems |

**`restart` doesn't read `.env`.** After changing `STRIPE_WEBHOOK_SECRET`, `restart`
left the old value in place and `up -d api` applied the new one.

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is built into the web image, so it needs
`docker compose up -d --build web`, not just a recreate. **Not run**; this comes
from `web/Dockerfile`.

The volume is `g4c_db_data` because Compose names projects after the folder. A
clone in a differently named folder gets its own separate database.

## 5. What's different now that EC2 is stopped

**Local dev only uses `docker-compose.yml`.** Nothing below is part of it.

| Don't run locally | Why |
|---|---|
| `docker compose -f docker-compose.prod.yml ...` | It uses the same project name and volume as local (`g4c`, `g4c_db_data`), so it would replace your local containers with GHCR images, on top of your local data. It also takes ports 80 and 443 for nginx |
| `scripts/deploy-pull.sh` | Runs that same prod file, then prunes dangling Docker images on your machine |
| Anything in `nginx/` | Only mounted by the prod file. Local traffic goes straight to `web` and `api` |
| `certbot` commands | Only exist in the prod file, and only work on the real domain |

The prod file was inspected with `docker compose -f docker-compose.prod.yml config`
only. It was never started.

| Thing | Behavior while EC2 is stopped |
|---|---|
| CI workflow | Still runs on every PR. Nothing changes |
| Deploy workflow | **Still runs on every merge to `main`** and pushes images to GHCR, but nothing pulls them. Merging no longer deploys anything |
| `eventify.social` | Down. Local is the only working copy |
| Cron on the instance | Not running, so no deploys or cert renewals |
| Stripe dashboard webhook | Still points at `eventify.social`, so those deliveries fail. Local uses `stripe listen` |

**When the instance restarts:**

- The cron job pulls `latest` within about 10 minutes, so everything merged while
  it was stopped goes live at once, with no gate.
- Schema changes don't come with it. Init SQL only runs on an empty volume, so any
  new columns must be applied to the production db by hand with `ALTER TABLE`.
- The TLS certificate expires on 2027-01-09. Renewal cron runs on the 1st and 15th
  and needs the instance running, so if it's been off past that date, renew by hand.

## 6. Production reference (EC2 running only)

Carried over from the earlier version of this file. **Not run:** the instance is
stopped.

### SSH

```bash
ssh -i <path-to-key.pem> ec2-user@<elastic-ip>
```

The app lives at `~/eventify` on the instance.

### Deploys

A merge to `main` triggers `.github/workflows/deploy.yml`, which builds and pushes
`ghcr.io/samadams412/g4c-api:latest` and `g4c-web:latest`. A cron job on the
instance runs `scripts/deploy-pull.sh` every 10 minutes, pulling any new images and
recreating only the containers that changed.

Manual fallback, on the instance:

```bash
cd ~/eventify
./scripts/deploy-pull.sh
```

Or by hand:

```bash
cd ~/eventify
docker compose -f docker-compose.prod.yml pull api web
docker compose -f docker-compose.prod.yml up -d --no-deps api web
docker image prune -f
```

### Certificate renewal

Automatic through a host crontab entry, twice a month:

```
0 3 1,15 * * cd ~/eventify && docker compose -f docker-compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot && docker compose -f docker-compose.prod.yml restart nginx
```

Manual re-run, on the instance:

```bash
cd ~/eventify
docker compose -f docker-compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot
docker compose -f docker-compose.prod.yml restart nginx
```

### Troubleshooting

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f <service>
docker compose -f docker-compose.prod.yml restart <service>
```

## 7. Where older docs disagree with this file

This file reflects what was observed when the commands were run. The older docs
weren't changed.

Most write-ups were removed from the repo in `a857de7` but are still in history:

```bash
git show a857de7^:docs/phase-writeups/phase-1-local-docker.md
```

| Source | It says | What actually happens |
|---|---|---|
| Earlier `docs/COMMANDS.md` | Rebuild after a dependency change | Rebuild after **any** code change |
| Phase 1 write-up | `ticket` is empty because seeding aborts | Seeding completes, with about 2,045 tickets |
| Phase 1 write-up | Init order is `01` to `05` | `01b` and `01c` seed scripts now run in between |
| Phase 6 write-up | Restart the `api` container to pick up a new webhook secret | `docker compose restart` keeps the old value. Use `docker compose up -d api` |
| Phase 8 log | A `PORT=3100` override in `.env` | The root `.env` key is `WEB_PORT`. Compose sets `PORT` per service |
| Phase 8 log | Links to `phase-8-deployment-runbook.md` | Removed from the repo, only in history |
| `.env.example` | Set `SEED_*_PASSWORD` here to control the seeded logins | The scripts don't read `.env`. Set a shell variable instead |
| `.env.example` | "see phase write-up" for `stripe listen` | That write-up is only in history. See section 2 |
| `README.md` | Setup is `source db/schema.sql` in `mysql -u root -p` | That loads into a host MySQL, which the app doesn't use. Use section 1 |
| `README.md` | Run any script in `seeds/` to generate data | Only `generate_data_v3.py` produces usable data |
