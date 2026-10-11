# Phase 9 — CI/CD

## What was built

**Branch protection on `main`**: pull requests required, with both CI
checks (`build-api`, `build-web`) required to pass before merging.
Direct pushes to `main` are blocked.

**CI workflow** (`.github/workflows/ci.yml`): runs on every PR into
`main`. Builds the `api` and `web` services independently (`npm ci` +
`npm run build` in each) so a broken build is caught before merge,
without needing Docker or any secrets.

**Deploy workflow** (`.github/workflows/deploy.yml`): runs on every
push to `main` (i.e. every merge). Builds Docker images for both
services and pushes them to GitHub Container Registry as
`ghcr.io/samadams412/g4c-api` and `ghcr.io/samadams412/g4c-web`, each
tagged `latest` and with the commit SHA.

**Production compose now pulls those images**: `docker-compose.prod.yml`'s
`api` and `web` services were changed from `build: ...` to
`image: ghcr.io/samadams412/g4c-{api,web}:latest`, so the instance
consumes the images CI/CD already built instead of rebuilding from
source on every deploy.

**`scripts/deploy-pull.sh`**: pulls the latest `api`/`web` images and
recreates only those two containers if their image changed
(`docker compose up -d --no-deps api web`), then prunes dangling
images. Meant to run from cron on the instance so new merges to `main`
reach production automatically within a bounded interval, without a
manual SSH-and-redeploy step each time.

## A real bug caught along the way

The deploy workflow's `docker/build-push-action` step for the `web`
service was missing the `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` build
argument. Next.js bakes `NEXT_PUBLIC_*` variables into the JS bundle at
build time, not at container start — so without that build-arg, every
`g4c-web` image pushed to GHCR would have shipped with an empty
Stripe publishable key baked in, silently breaking checkout in
production regardless of what the instance's `.env` said. Fixed by
passing it as a build-arg sourced from a new repo secret of the same
name (see below).

## What's still manual — and has to be, by this project's own rule

Claude Code doesn't touch AWS, the live instance, or (by extension)
account-level GitHub settings that only Sam can see the current state
of. Everything below needs Sam to do it by hand; the PR
(`ghcr-deploy-images`) and this write-up only prepare for it.

1. **Add the `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` repo secret** —
   Settings → Secrets and variables → Actions → New repository
   secret. Use the same `pk_test_...` value already in the
   production `.env`. Without this, the build-arg fix above has
   nothing to substitute and the image still ships with an empty key.
2. **Make the GHCR packages reachable from the instance.** GHCR
   packages built via the default `GITHUB_TOKEN` are **private by
   default**, even when the source repo is public. Right now
   `docker compose pull` on the instance would get a 401. Two ways to
   fix it, pick one:
   - Package settings on GitHub (Packages tab on the repo, or
     `github.com/users/samadams412/packages/container/g4c-api` /
     `g4c-web`) → Package settings → Change visibility → Public.
     Simplest, since these images contain no secrets (env vars are
     injected at container start, not baked in, except the Stripe
     publishable key above which is meant to be public anyway).
   - Or, if they should stay private: generate a classic PAT with
     `read:packages` scope and run `docker login ghcr.io -u
     samadams412 -p <PAT>` once on the instance before the first pull
     (cron's non-interactive shell will reuse the saved credential
     from `~/.docker/config.json` after that).
3. **Set up the cron job on the instance** to run
   `scripts/deploy-pull.sh` periodically, e.g. every 10 minutes:
   ```
   */10 * * * * cd /path/to/g4c && ./scripts/deploy-pull.sh >> /var/log/eventify-deploy-pull.log 2>&1
   ```
   (Reuses the `cronie`/`crond` setup already done in Phase 8 for
   cert renewal — just another line in the same crontab.)
4. **Merge PR `ghcr-deploy-images`** once 1–3 are done and CI is
   green on it, then pull the repo's latest on the instance one more
   time by hand (`git pull`) since this PR itself changes
   `docker-compose.prod.yml` and `scripts/deploy-pull.sh`, which the
   pull script can't bootstrap into existence on its own.

## Known gaps, not blocking

- No rollback tooling — reverting means merging a revert PR and
  waiting for the next cron tick (or running the pull script by hand
  immediately after).
- `latest` is a moving tag; nothing currently pins production to a
  specific SHA, so a bad merge to `main` reaches production on the
  next cron tick with no gate beyond CI passing on the PR.
- No deploy notification — cron runs silently; `/var/log/eventify-deploy-pull.log`
  on the instance is the only record unless that's piped somewhere else.
