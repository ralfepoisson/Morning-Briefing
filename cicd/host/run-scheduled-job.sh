#!/usr/bin/env bash
set -euo pipefail
umask 0077

APP_ROOT="${APP_ROOT:-/srv/apps/morning-briefing}"
job="${1:-}"
case "${job}" in
  snapshot-refresh|dashboard-audio-refresh) ;;
  *) echo "Unknown scheduled job." >&2; exit 2 ;;
esac

exec flock -n "${APP_ROOT}/locks/${job}.lock" \
  docker compose \
    --project-name morning-briefing \
    --env-file "${APP_ROOT}/current/release.env" \
    -f "${APP_ROOT}/current/cicd/compose/compose.yaml" \
    --profile schedules run --rm "${job}"
