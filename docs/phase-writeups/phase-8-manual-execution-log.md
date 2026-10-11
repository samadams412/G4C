# Phase 8 — Manual Execution Log (Production Deployment)

Claude Code's Phase 8 runbook (`docs/phase-writeups/phase-8-deployment-runbook.md`)
laid out the intended steps, but per the project's standing rule, Claude Code
never touches AWS or the live instance directly. Every step below was executed
by Sam himself, with Claude (chat) walking through it step by step and
debugging in real time wherever the runbook's assumptions didn't match reality.
This is the record of what actually happened, as a companion to that runbook
rather than a replacement for it.

## What was done

1. **EC2 instance launched**: Amazon Linux 2023, `t3.small` (2 GiB RAM — not
   free-tier eligible; running cost is roughly $15-17/month if left on
   24/7), 20 GiB gp3 storage, security group restricted to SSH (22, own IP
   only), HTTP (80), and HTTPS (443) from anywhere. No other ports opened —
   `db`/`api`/`web` are not published to the host in the production compose
   file, so nginx is the only path in.
2. **Elastic IP** (`16.59.216.76`) allocated and associated with the
   instance, so the public address survives stop/restart.
3. **Docker installed** via `dnf install docker`, user added to the `docker`
   group, Compose v2 plugin installed manually (Amazon Linux's package
   doesn't ship it).
4. **Domain purchased**: `eventify.social` on Hostinger (~$6/year) —
   needed because Stripe's Payment Element requires valid HTTPS in
   production, which requires a real hostname for Let's Encrypt's HTTP-01
   challenge.
5. **Repo pushed and cloned** onto the instance from GitHub.
6. **Production `.env` created**: copied from local dev via `scp`, then
   rotated `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, and `JWT_SECRET` to new
   values generated with `openssl rand -base64`. Stripe keys deliberately
   left as test-mode values (`sk_test_`/`pk_test_`) per the standing
   decision to never process live payments on this app.
7. **First boot over plain HTTP** using a bootstrap nginx config (the real
   HTTPS config references a cert that doesn't exist yet), to give Certbot
   something to validate against.
8. **DNS pointed** at the Elastic IP (`A` records for both `eventify.social`
   and `www.eventify.social`) — propagated within minutes.
9. **TLS certificate issued** via Certbot/Let's Encrypt, valid through
   2027-01-09. nginx switched from the bootstrap config to the real
   HTTPS config and restarted.
10. **Cert auto-renewal** scheduled via cron, running twice a month.
11. **Stripe webhook registered** in the dashboard (test mode) pointed at
    `https://eventify.social/webhooks/stripe`, with the resulting signing
    secret placed in the production `.env` and the `api` container
    restarted to pick it up.
12. **Full purchase flow verified live**: registered a real account,
    completed checkout with a Stripe test card, confirmed the order
    actually reached `Completed` status via webhook (checked directly in
    the production database, not just the UI's confirmation message).

## Real-world gaps in the runbook, found while executing it

Amazon Linux 2023's minimal install is leaner than the runbook assumed:

- `git` wasn't installed (`dnf install docker` doesn't pull it in) —
  `sudo dnf install -y git` fixed it.
- `docker compose build` failed with "compose build requires buildx 0.17.0
  or later" — the bundled buildx plugin was missing/outdated. Fixed by
  downloading the current release directly from GitHub (used the GitHub
  API, `curl -s https://api.github.com/repos/docker/buildx/releases/latest`,
  to find the real asset URL rather than guessing a version number, which
  failed once already).
- `crontab` wasn't available (`cronie` isn't installed by default) —
  `sudo dnf install -y cronie && sudo systemctl enable --now crond` fixed
  it, before the renewal cron job could be added.

Two real bugs, not just missing packages:

- **A dev-only `PORT=3100` override had been copied into the production
  `.env`** (a leftover from a local port conflict noted back in Phase 1,
  where host port 3000 was already taken on Sam's machine). In production,
  nothing is competing for port 3000, but the override was still steering
  the `web` container's actual listen port to 3100 while nginx's config
  proxied to the default 3000 — causing a 502 Bad Gateway on first boot.
  Removed the override from the production `.env` and restarted `web`.
- **A Claude Code commit had added a `Co-authored-by: Claude` git trailer**,
  violating the project's standing no-AI-attribution policy for this solo
  repo. Fixed by amending the commit to drop the trailer and force-pushing;
  confirmed with `git log --all -i --grep="co-authored-by.*claude"` that no
  other commit in the repo's history carries one.

## Other issues resolved along the way

- **Seeded admin/test account passwords rotated in the live database.**
  `SEED_ADMIN_PASSWORD`/`SEED_TEST_USER_PASSWORD` turned out to only affect
  a one-time local script (`seed_admin.py`/`seed_test_user.py`) that bakes
  a bcrypt hash into a committed SQL file at generation time — the
  production `.env` never reaches that script at container runtime. That
  meant the production database was seeded with `admin@eventify.dev` and
  `attendee@eventify.dev` using whatever password hash was baked into the
  committed init SQL, almost certainly the publicly documented dev default.
  Fixed by generating fresh bcrypt hashes via the `api` container's own
  `bcryptjs` library and updating both accounts directly in the production
  database (rather than regenerating the seed SQL files, which would have
  required wiping the database and losing real test order data already in
  it).

## Known gaps, not blocking

- No automated database backups (a cron'd `mysqldump` to off-box storage
  is the natural next step if this is ever trusted with real user data).
- No cron sweep for expired Stripe reservations — still just excluded from
  capacity counts, as noted since Phase 6.
- `t3.small` isn't free-tier; Sam plans to stop the instance when not
  actively demoing the app to control cost.
