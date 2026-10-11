#!/usr/bin/env bash
# Pulls the latest api/web images from GHCR and restarts only the
# containers whose image actually changed. Intended to run on the
# production instance via cron (see docs/phase-writeups for setup).
#
# Idempotent: if nothing new was pulled, `docker compose up -d` is a no-op.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

LOG_PREFIX="[deploy-pull $(date -u +%Y-%m-%dT%H:%M:%SZ)]"

echo "$LOG_PREFIX pulling latest images"
docker compose -f docker-compose.prod.yml pull api web

echo "$LOG_PREFIX recreating any containers with new images"
docker compose -f docker-compose.prod.yml up -d --no-deps api web

echo "$LOG_PREFIX pruning dangling images"
docker image prune -f >/dev/null

echo "$LOG_PREFIX done"
