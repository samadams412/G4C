# Phase 4: Login, Register, and Session-Aware Nav

## What was built

Login and register pages, a global nav that reflects logged-in state, and
route protection for logged-in-only pages, wired to the Phase 2 auth
endpoints. No booking flow — that's still a separate piece.

### A register endpoint had to be added first

Phase 2 only shipped `POST /auth/login`; there was no register endpoint at
all. Added `registerHandler` to `api/src/auth.ts`, following `loginHandler`'s
existing shape exactly: validates `first_name`/`last_name`/`email`/`password`
(the `user` table's required columns besides `role`/`status`), hashes with
bcrypt, inserts with `role` hardcoded to `'Attendee'` (self-registration
can't grant Organizer/Admin), and returns `{ token }` like login does. Wired
into `index.ts` as `POST /auth/register`. Also added `first_name` to the JWT
payload on both handlers (previously just `user_id`/`role`) so the web app
has a display name without a second lookup.

### Files added

- `web/lib/session.ts` — server-only helper that reads the `session` cookie
  and decodes the JWT payload (doesn't verify the signature — see shortcuts
  below).
- `web/app/api/auth/{login,register,logout}/route.ts` — Next.js route
  handlers that proxy to the Express API server-side (the browser can't
  reach `API_URL` directly; it's a Docker-internal hostname) and, on
  success, set/clear an httpOnly `session` cookie holding the JWT.
- `web/app/login/page.tsx` + `LoginForm.tsx`, `web/app/register/page.tsx` —
  the two forms. Login's form is split into a separate client component so
  `useSearchParams()` (used for the post-login `?next=` redirect) can sit
  inside a `<Suspense>` boundary.
- `web/app/Nav.tsx` — server component, reads the session and renders
  either "Log in"/"Register" links or an avatar initial + name + a
  `LogoutButton` client component.
- `web/app/LogoutButton.tsx` — client component, posts to the logout route
  then refreshes.
- `web/app/account/page.tsx` — minimal placeholder page demonstrating route
  protection; shows the logged-in user's name and a note that bookings will
  live there later.
- `web/middleware.ts` — redirects to `/login?next=<path>` when the `session`
  cookie is missing, matched against `/account/:path*`. This is the prefix
  the booking flow can build under later.

### Files changed

- `web/app/layout.tsx` — renders `<Nav />` above `{children}` so it's on
  every page (there was no nav at all before this).
- `api/src/auth.ts`, `api/src/index.ts` — see register endpoint above.

## Key decisions

- **Token storage follows what the API actually returns**: a bearer JWT,
  not a cookie. Since the browser can't call the Express API directly
  (`API_URL` only resolves inside the Docker network), the Next.js route
  handlers act as a server-side proxy and move the JWT into an httpOnly
  cookie. That's safer than `localStorage` and lets the nav and middleware
  read it without extra client-side plumbing.
- **Register form has exactly the fields the schema requires**: first name,
  last name, email, password. No confirm-password field, no role picker.
- **Palette untouched**: forms and nav reuse the existing `lib/colors.ts`
  tokens and the violet-for-primary-action convention already established
  (active filter pill, "Back to events" link) — no new colors introduced.

## Verification

- `docker compose up -d --build` — clean build, including the new
  `middleware.ts` compiling as Edge middleware (confirmed in the build
  output: `ƒ Middleware 26.5 kB`).
- `curl -X POST /auth/register` against the API directly — confirmed a new
  endpoint issuing a JWT.
- Real browser flow: registered a new account (Alex Morgan) through the
  UI, screenshot confirmed redirect to `/events` with the nav showing the
  violet avatar initial + "Alex" + "Log out". Clicked Log out, confirmed
  the nav reverted to "Log in"/"Register". Navigated directly to
  `/account` while logged out, confirmed the middleware redirected to
  `/login?next=%2Faccount`. Logged back in with the same credentials,
  confirmed it honored `next` and landed on `/account` showing "Hi, Alex"
  with the nav still in its logged-in state.
- All new UI copy (button labels, error messages, nav labels, account
  placeholder text) was checked against the humanizer skill's AI-tell
  list — no changes needed.

## Known gaps / follow-ups

- No "forgot password" or email verification flow.
- No rate limiting on `/auth/login` or `/auth/register`.
- Booking flow itself is explicitly out of scope; `/account` is a
  placeholder proving the protection mechanism works, not a real feature.

## Follow-up: real JWT verification, closing the presence-only gap

The two shortcuts flagged above (session trust was presence-only — a
cookie named `session` with any value was treated as logged in) are
closed. Both `middleware.ts` and `lib/session.ts` now verify the JWT's
signature and expiry against the same secret the API signs with, and
treat a failed verification exactly like logged-out.

### Changes

- `docker-compose.yml` — the `web` service now gets `JWT_SECRET: ${JWT_SECRET}`,
  the same env var the `api` service already used. One secret, shared
  between both containers.
- `web/package.json` — added `jose`. `jsonwebtoken` (used by the API)
  depends on Node's `crypto` module and doesn't run in Next's Edge
  middleware runtime; `jose` works in both Edge and Node, so it's the one
  library used in both `middleware.ts` and `lib/session.ts`.
- `web/lib/session.ts` — `getSessionUser()` (and a new `verifySession()`
  it's built on) now calls `jose`'s `jwtVerify()` against `JWT_SECRET`
  instead of just base64-decoding the payload. Became `async`; its two
  callers (`Nav.tsx`, `account/page.tsx`) were updated to `await` it.
- `web/middleware.ts` — rewritten:
  - Verifies the token with `jwtVerify()` instead of just checking the
    cookie exists.
  - Widened from matching only `/account/:path*` to running on every page
    request (excluding static assets and the `/api/auth/*` routes, which
    manage the cookie directly — letting this middleware also touch
    `Set-Cookie` on those same responses would race with them). This
    matters because a stale/invalid cookie can arrive on any page, not
    just protected ones, and needed clearing site-wide, not just blocked
    on `/account`.
  - On an invalid or expired token, clears the `session` cookie in the
    response (`response.cookies.delete("session")`) on every request, and
    additionally redirects to `/login?next=<path>` when the path is under
    a protected prefix (currently just `/account`).

### Verification

Tested beyond the happy path, against the real running stack:

- **Valid token**: registered and logged in a user via the API directly,
  took the returned JWT, sent it as the `session` cookie via `curl -b` to
  `/account` — got a 200 with the user's name rendered in both the nav and
  the page body, confirming `lib/session.ts`'s own verification (not just
  middleware) succeeds on a good token.
- **Tampered token**: flipped the last character of a valid token's
  signature, sent it to `/account` — got a 307 to `/login?next=%2Faccount`
  *and* a `Set-Cookie: session=; Expires=Thu, 01 Jan 1970...` in the same
  response, confirming the stale cookie gets cleared, not just blocked.
- **Expired token**: signed a token with `jsonwebtoken` (same secret,
  `expiresIn: "-1h"`) to get a validly-signed but already-expired JWT.
  Against `/account`: same 307 + cookie-clear as the tampered case.
  Against the public `/events` page: no redirect (expected, it's not a
  protected path), but the nav rendered "Log in" rather than the user's
  name — confirming `lib/session.ts`'s independent verification inside
  the page itself also rejects it, not just the middleware gate. This is
  the defense-in-depth check the task asked for: two layers, both
  actually verifying.
- `docker compose up -d --build` — clean build; `jose` resolved and
  installed with no lockfile present to conflict with, middleware compiled
  successfully as Edge middleware with the larger `jose`-inclusive bundle
  size reflected in the build output.
