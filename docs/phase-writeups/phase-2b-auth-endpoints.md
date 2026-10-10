# Phase 2b — Login & Role-Checking Middleware

## What was built

- `api/src/auth.ts`:
  - `loginHandler(pool)` — `POST /auth/login` handler. Looks up `user` by
    email, compares the password against `password_hash` with
    `bcryptjs`, and on success signs a JWT (1h expiry) containing
    `user_id` and `role`.
  - `authenticate` — middleware that reads `Authorization: Bearer <jwt>`,
    verifies it, and attaches the decoded payload to `req.user`. Rejects
    missing or invalid tokens with 401.
  - `requireAdmin` — wraps `authenticate`, then additionally rejects any
    request where `req.user.role !== "Admin"` with 403.
- `api/src/index.ts`: added `express.json()`, wired `POST /auth/login`,
  and added `GET /admin/ping` (verification-only route behind
  `requireAdmin` — not an event/ticket/venue/category endpoint, just a
  minimal route to prove the middleware works end to end).
- Added `bcryptjs` and `jsonwebtoken` (+ their `@types`) to
  `api/package.json`. `bcryptjs` was used instead of the native `bcrypt`
  package to avoid a native build step in the Alpine Docker image; it
  produces/reads the same `$2a$`/`$2b$` hash format as the Python
  `bcrypt` used to seed the admin account in phase 2a.
- Added `JWT_SECRET` to the `api` service env in `docker-compose.yml` and
  to `.env.example` (local `.env` got a dev-only value).

No event/ticket/venue/category endpoints were added, per the task scope.

## Key decisions

- `requireAdmin` composes `authenticate` rather than re-implementing JWT
  verification, so there's one code path for decoding/validating a
  token.
- JWT payload is kept minimal (`user_id`, `role`) — exactly what
  role-checking middleware needs, nothing else.
- `JWT_SECRET` has no fallback/default in code — the module throws at
  startup if it's unset, rather than silently signing tokens with a weak
  default.

## Verification

Rebuilt `db` + `api` with `docker compose up -d --build db api` and ran
against the real seeded admin from phase 2a (`admin@eventify.dev` /
`ChangeMe123!`, the `SEED_ADMIN_PASSWORD` default):

**No token → 401:**
```
GET /admin/ping
HTTP/1.1 401 Unauthorized
{"error":"missing token"}
```

**Login with correct password → 200 + JWT:**
```
POST /auth/login {"email":"admin@eventify.dev","password":"ChangeMe123!"}
HTTP/1.1 200 OK
{"token":"eyJhbGciOiJIUzI1NiIs...<redacted>...jdf1M"}
```

**Login with wrong password → 401:**
```
POST /auth/login {"email":"admin@eventify.dev","password":"wrong"}
HTTP/1.1 401 Unauthorized
{"error":"invalid credentials"}
```

**Valid admin token → 200, `requireAdmin` passes and decoded user is attached:**
```
GET /admin/ping  (Authorization: Bearer <token from login>)
HTTP/1.1 200 OK
{"ok":true,"user":{"user_id":999,"role":"Admin","iat":1791627154,"exp":1791630754}}
```

## Known gaps / follow-ups

- No refresh tokens, logout/blacklist, or rate limiting on `/auth/login`.
- `GET /admin/ping` is a throwaway verification route; remove it once
  real admin endpoints exist.

## Addendum — seeded non-admin test account

Closed the gap above: added `seeds/seed_test_user.py`, the same pattern
as `seeds/seed_admin.py` from phase 2a — bcrypt-hashes
`SEED_TEST_USER_PASSWORD` (default `ChangeMe123!`, documented in
`.env.example`) and writes a single `Attendee` row
(`attendee@eventify.dev`, `user_id = 998`) to its own
`db/docker-init/01c-seed-test-user.sql`, mounted in `docker-compose.yml`
right after the admin seed file so init ordering stays explicit.

Verified by rebuilding from a clean volume (`docker compose down -v` /
`up -d db api`), confirming both seeded rows exist with bcrypt hashes,
then logging in as the test account and hitting the admin-only route
with its token:

```
POST /auth/login {"email":"attendee@eventify.dev","password":"ChangeMe123!"}
HTTP/1.1 200 OK
{"token":"eyJhbGciOiJIUzI1NiIs...<redacted>...Ekz-u4"}

GET /admin/ping  (Authorization: Bearer <attendee token>)
HTTP/1.1 403 Forbidden
{"error":"admin access required"}
```

Confirms `requireAdmin` correctly distinguishes "no/invalid token" (401,
verified above) from "valid token, wrong role" (403, verified here).
