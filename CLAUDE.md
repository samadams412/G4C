# Eventify — Project Rules

## Attribution

Do not add yourself as a contributor, co-author, or committer.
Never include "Co-Authored-By: Claude", "Generated with Claude Code", or any
AI-attribution trailer, footer, or signature in commit messages, PR
descriptions, or code comments. All commits are authored solely by Sam
Adams. Use conventional commit format (feat:, fix:, chore:, docs:, etc.),
imperative mood, no trailers beyond what a human would normally write.

## Git workflow

Never commit directly to `main`. For any code change:
1. Create a new branch off `main` (`git checkout -b descriptive-branch-name`)
2. Commit there
3. Push and open a pull request
4. Wait for CI to pass before merging — don't merge with a failing check

If `main` is checked out when starting work, ensure that main is up to date, then switch to a new branch
before making any changes.

## Phase write-ups

At the end of every phase/session of work, write a detailed write-up of
what was done — what was built, key decisions made and why, how it was
verified, and any follow-ups or known gaps — saved to
`docs/phase-writeups/`, one file per phase
(e.g. `docs/phase-writeups/phase-1-local-docker.md`).
