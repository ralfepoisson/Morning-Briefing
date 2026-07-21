#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/srv/apps/morning-briefing}"
target="${1:-}"
[[ -n "${target}" ]] || { echo "Usage: rollback.sh <release-directory>" >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo "Rollback must run through the root boundary." >&2; exit 1; }
[[ "${target}" == /* ]] || target="${APP_ROOT}/releases/${target}"
[[ -f "${target}/release-manifest.json" ]] || { echo "Target release manifest is missing." >&2; exit 1; }

# shellcheck source=../../../scripts/lib/release-common.sh
source "${target}/scripts/lib/release-common.sh"
acquire_deploy_lock "${APP_ROOT}/locks/deploy.lock"
validate_release_manifest "${target}/release-manifest.json"

current="$(readlink -f "${APP_ROOT}/current" 2>/dev/null || true)"
if [[ -n "${current}" && -f "${current}/release-manifest.json" ]]; then
  current_migration="$(jq -r '.migrationId' "${current}/release-manifest.json")"
  target_migration="$(jq -r '.migrationId' "${target}/release-manifest.json")"
  if [[ "${current_migration}" != "${target_migration}" ]]; then
    echo "Automatic rollback refused: database migration identifiers differ." >&2
    echo "Restore the matching pre-migration backup or approve an application-only rollback after compatibility review." >&2
    exit 1
  fi
fi

START_WORKER="${START_WORKER:-false}"
if [[ "${START_WORKER}" == "true" && "${WRITER_HANDOFF_APPROVED:-false}" != "true" ]]; then
  die "Worker start requires WRITER_HANDOFF_APPROVED=true."
fi
services=(frontend backend)
[[ "${START_WORKER}" == "true" ]] && services+=(worker)
docker compose --project-name morning-briefing --env-file "${target}/release.env" -f "${target}/cicd/compose/compose.yaml" pull "${services[@]}"
docker compose --project-name morning-briefing --env-file "${target}/release.env" -f "${target}/cicd/compose/compose.yaml" up -d --remove-orphans "${services[@]}"
START_WORKER="${START_WORKER}" "${target}/cicd/host/health-check.sh" "${target}"
ln -sfn "${target}" "${APP_ROOT}/current.next"
mv -Tf "${APP_ROOT}/current.next" "${APP_ROOT}/current"
echo "Rolled back to $(basename "${target}")."
