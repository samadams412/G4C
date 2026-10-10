# Phase 2a — Auth Schema

## What was built

- Added `password_hash VARCHAR(255) DEFAULT NULL` to `user` in `db/schema.sql`.
  No other columns were added — email already serves as the login
  identifier and `role`/`status` already exist. Nullable because the 500
  generated dummy rows have no password.
- Added `seeds/seed_admin.py`, a small standalone script (separate from
  `generate_data_v3.py`) that bcrypt-hashes a password from the
  `SEED_ADMIN_PASSWORD` env var (default `ChangeMe123!`, documented in
  `.env.example`) and writes a single admin INSERT to
  `db/docker-init/01b-seed-admin.sql`.
- Wired that file into `docker-compose.yml`'s `db` service mounts, run as
  `01b` — right after schema creation, before triggers/procedures/view/
  dummy data.
- Added `bcrypt==4.3.0` to `requirements.txt`.

No API endpoints were built, per the task scope.

## Key decisions

- **Seeded admin runs before, not after, `dummy_data.sql`.** MySQL's
  `docker-entrypoint-initdb.d` runs files in alphabetical order and aborts
  the whole init sequence on the first failing file. `dummy_data.sql` has
  a pre-existing, unrelated bug: one of its generated ticket rows violates
  a trigger (`Cannot purchase a ticket for an event that is Canceled or
  Completed`), which aborts init before later files run. Rather than fix
  that unrelated bug (out of scope — schema/seed data for auth only), the
  admin seed was ordered to run independently of it, so the admin account
  is always created regardless.
- **`user_id = 999`** for the seeded admin, outside the `1-500` range used
  by `generate_data_v3.py`, to avoid collisions.
- **Hash, not password, is committed.** `db/docker-init/01b-seed-admin.sql`
  contains only the bcrypt output; the plaintext dev password lives only
  in `SEED_ADMIN_PASSWORD` (`.env.example`, with an obvious placeholder
  default), never in a committed SQL file.

## Verification

Rebuilt the local stack from a clean volume (`docker compose down -v` then
`docker compose up -d db`) and queried the running container:

```
user_id  email               role   status  password_hash
999      admin@eventify.dev  Admin  Active  $2b$12$6glR8egXOqHeFQM.y//Wq.TkgCcCJ7.okASXzHvsFkBDDzA8xr8E2
```

Confirms the admin row exists with a bcrypt hash, not a plaintext
password.

## Known gaps / follow-ups

- The pre-existing `dummy_data.sql` trigger failure (canceled/completed
  event ticket) still breaks that file's own init step and should be
  fixed separately — it's unrelated to auth.
- No API/login endpoint yet (explicitly out of scope this session).
- No password complexity/rotation policy, rate limiting, or account
  lockout — those belong with the login endpoint work, not the schema.
