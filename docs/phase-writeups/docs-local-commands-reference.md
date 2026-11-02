# Local commands reference

Rewrote `docs/commands.md` as a verified local dev reference now that the EC2
instance is stopped. This is a docs-only change.

## What changed

- `docs/COMMANDS.md` was an untracked file, so it's now tracked as
  `docs/commands.md`. Its production sections moved to section 6, with the
  troubleshooting block narrowed to the prod file.
- Added first-time setup, everyday dev, build and verify, and Docker sections.
- Added what's different with EC2 stopped, and a table of where older docs
  disagree with observed behavior.

## How it was verified

Commands ran in a throwaway clone of `main` on separate ports, so its Compose
project and volume were separate from the real `g4c_db_data`. The real stack was
left running. The clone, its images and its volume were removed afterwards.

- **Lifecycle:** `up --build`, `ps`, `logs`, `restart`, `stop`, `start`, `down` and
  `down -v`. A marker user survived `stop` and `down`, and `down -v` removed it.
- **Outside Docker:** both `npm` projects with and without env files, including a
  login through `next dev` and a protected page.
- **Rebuilds:** a source edit wasn't picked up by `up -d`, and was by
  `up -d --build web`.
- **Env reloads:** an `.env` edit wasn't picked up by `restart`, and was by `up -d api`.
- **Seeds:** all three generators and both seed scripts, each loaded into a fresh
  db where relevant.
- **SQL files:** the `db/analysis/` and lifecycle files, piped from PowerShell.

Not run: `stripe login`, a full Stripe purchase, interactive shells, anything on
the production instance, `docker-compose.prod.yml` beyond `config`, and
`db/automation/triggers.sql` and `procedures.sql`. The doc marks these.

## Incident during verification

To test `<` redirection in Git Bash, `db/analysis/sample_queries.sql` was run
against the real local stack on the assumption that it was read-only. It's an
`INSERT`, and it added user 1004 (`kosha.admin@eventify.com`).

The row was confirmed as the one just inserted, with no password, orders or
references, and deleted by ID and email. Users went from 507 back to 506; orders
(1,014), tickets (2,068) and events (200) were unchanged. The `user` table's
`AUTO_INCREMENT` stays at 1005, so ID 1004 is skipped. This has no functional
effect and a `down -v` reset clears it.

Section 2 of `docs/commands.md` now lists which SQL files change data.

## Follow-ups and known gaps

- **Local db unreachable from the host:** the Windows `MySQL84` service holds
  3306, so Sam's `.env` needs `DB_HOST_PORT=3307` to run the API outside Docker.
  `.env` wasn't changed.
- **Port 3100 conflict:** `wow-forever-planner` listens there too.
- **Stale local images:** the running `g4c-web` and `g4c-api` images were 3 weeks
  old at the time of writing.
- **Older docs:** `.env.example` and `README.md` are still out of date. They were
  flagged in section 7 rather than changed.
- **Broken or misleading seed tooling:** `generate_data_v2.py` no longer matches
  the schema, and `generate_data.py` writes to the repo root.
- **`.gitignore` gaps:** `web/next-env.d.ts` and `.venv/` aren't ignored. The
  `docs\phase-writeups\*` pattern uses backslashes, so it has no effect.
- **No lint or tests** exist in either project.
- **Standalone server:** `node .next/standalone/server.js` failed to start on
  Windows. The cause wasn't investigated.
