#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/srv/apps/morning-briefing}"
release_dir="${1:-}"
[[ -n "${release_dir}" ]] || { echo "Usage: deploy.sh <absolute-release-directory>" >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo "Deployment must run through the root activation boundary." >&2; exit 1; }
release_dir="$(cd "${release_dir}" && pwd)"

# shellcheck source=../../../scripts/lib/release-common.sh
source "${release_dir}/scripts/lib/release-common.sh"
acquire_deploy_lock "${APP_ROOT}/locks/deploy.lock"
validate_release_manifest "${release_dir}/release-manifest.json"

compose_file="${release_dir}/cicd/compose/compose.yaml"
expected_compose_sha="$(jq -r '.composeSha256' "${release_dir}/release-manifest.json")"
[[ "$(sha256_file "${compose_file}")" == "${expected_compose_sha}" ]] || die "Compose checksum mismatch."

assert_secret_file_mode "${APP_ROOT}/secrets/backend.env"
assert_secret_file_mode "${APP_ROOT}/secrets/worker.env"
assert_secret_file_mode "${APP_ROOT}/secrets/rabbitmq.env"
[[ -f "${APP_ROOT}/shared/config/backend.env" && -f "${APP_ROOT}/shared/config/worker.env" ]] || die "Shared service configuration is incomplete."
for secret_file in "${APP_ROOT}/secrets/backend.env" "${APP_ROOT}/secrets/worker.env"; do
  require_env_key "${secret_file}" DATABASE_URL
  require_env_key "${secret_file}" MESSAGE_BROKER_URL
  require_env_key "${secret_file}" GOOGLE_OAUTH_CLIENT_ID
  require_env_key "${secret_file}" GOOGLE_OAUTH_CLIENT_SECRET
  require_env_key "${secret_file}" GOOGLE_OAUTH_STATE_SECRET
  require_env_key "${secret_file}" OPENAI_API_KEY
  require_one_env_key "${secret_file}" LIFE2_JWT_SECRET LIFE2_JWT_PUBLIC_KEY
done
for rabbit_key in RABBITMQ_DEFAULT_USER RABBITMQ_DEFAULT_PASS RABBITMQ_ERLANG_COOKIE; do
  require_env_key "${APP_ROOT}/secrets/rabbitmq.env" "${rabbit_key}"
done
for config_file in "${APP_ROOT}/shared/config/backend.env" "${APP_ROOT}/shared/config/worker.env"; do
  for config_key in \
    MESSAGE_BROKER_ENABLED \
    MESSAGE_BROKER_EXCHANGE \
    MESSAGE_BROKER_QUEUE \
    MESSAGE_BROKER_RETRY_QUEUE \
    MESSAGE_BROKER_DLQ \
    MESSAGE_BROKER_RETRY_DELAY_MS \
    MESSAGE_BROKER_MAX_ATTEMPTS \
    MESSAGE_BROKER_PREFETCH \
    MESSAGE_BROKER_RECONNECT_DELAY_MS \
    SNAPSHOT_JOB_LEASE_SECONDS; do
    require_env_key "${config_file}" "${config_key}"
  done
  require_env_value "${config_file}" MESSAGE_BROKER_ENABLED true
done
"${release_dir}/cicd/host/install-systemd-units.sh" "${release_dir}"
prepare_runtime_directory "${APP_ROOT}/data/audio" 10001 10001
prepare_runtime_directory "${APP_ROOT}/data/rabbitmq" 100 101
install -d -m 0750 "${APP_ROOT}/backups" "${APP_ROOT}/locks"

compose() {
  docker compose --project-name morning-briefing --env-file "${release_dir}/release.env" -f "${compose_file}" "$@"
}

compose config --quiet
backend_image="$(jq -r '.images.backend' "${release_dir}/release-manifest.json")"
frontend_image="$(jq -r '.images.frontend' "${release_dir}/release-manifest.json")"
validate_digest_ref "${backend_image}"
validate_digest_ref "${frontend_image}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="${APP_ROOT}/backups/pre-migration-${timestamp}.dump"
postgres_container="${POSTGRES_CONTAINER:-postgres}"
postgres_database="${POSTGRES_DATABASE:-morning_briefing}"
docker exec -u postgres "${postgres_container}" pg_dump --format=custom --dbname="${postgres_database}" --file="/tmp/morning-briefing-${timestamp}.dump"
docker cp "${postgres_container}:/tmp/morning-briefing-${timestamp}.dump" "${backup}"
docker exec -u postgres "${postgres_container}" rm -f "/tmp/morning-briefing-${timestamp}.dump"
sha256_file "${backup}" > "${backup}.sha256"

status_log="$(mktemp)"
trap 'rm -f "${status_log}"' EXIT
if ! compose --profile ops run --rm --no-deps migrate npx prisma migrate status >"${status_log}" 2>&1; then
  if ! grep -q 'have not yet been applied' "${status_log}"; then
    sed -E 's#(postgresql://)[^@]+@#\1[redacted]@#g' "${status_log}" >&2
    die "Prisma migration status failed before deployment."
  fi
fi
compose --profile ops run --rm --no-deps migrate npm run db:deploy
compose --profile ops run --rm --no-deps migrate npx prisma migrate status

START_WORKER="${START_WORKER:-false}"
if [[ "${START_WORKER}" == "true" && "${WRITER_HANDOFF_APPROVED:-false}" != "true" ]]; then
  die "Worker start requires WRITER_HANDOFF_APPROVED=true after ECS and EventBridge writers are stopped."
fi
services=(rabbitmq frontend backend)
[[ "${START_WORKER}" == "true" ]] && services+=(worker)
previous="$(readlink -f "${APP_ROOT}/current" 2>/dev/null || true)"

deploy_candidate() {
  compose up -d --remove-orphans "${services[@]}"
}

verify_candidate() {
  START_WORKER="${START_WORKER}" "${release_dir}/cicd/host/health-check.sh" "${release_dir}"
}

rollback_application() {
  echo "Release failed; restoring the previous application release." >&2
  if [[ -n "${previous}" && -d "${previous}" ]]; then
    previous_migration="$(jq -r '.migrationId' "${previous}/release-manifest.json")"
    release_migration="$(jq -r '.migrationId' "${release_dir}/release-manifest.json")"
    if [[ "${previous_migration}" != "${release_migration}" ]]; then
      echo "Automatic application rollback refused because the migration identifier changed." >&2
      echo "Candidate services will be stopped; restore ${backup} before starting the previous release." >&2
      compose stop "${services[@]}" || true
      return 1
    fi
    previous_services=(frontend backend)
    if docker compose --project-name morning-briefing --env-file "${previous}/release.env" -f "${previous}/cicd/compose/compose.yaml" config --services | grep -Fxq rabbitmq; then
      previous_services=(rabbitmq frontend backend)
    fi
    [[ "${START_WORKER}" == "true" ]] && previous_services+=(worker)
    docker compose --project-name morning-briefing --env-file "${previous}/release.env" -f "${previous}/cicd/compose/compose.yaml" pull "${previous_services[@]}" || true
    docker compose --project-name morning-briefing --env-file "${previous}/release.env" -f "${previous}/cicd/compose/compose.yaml" up -d --remove-orphans "${previous_services[@]}" || true
    START_WORKER="${START_WORKER}" "${previous}/cicd/host/health-check.sh" "${previous}" || true
  else
    compose stop "${services[@]}" || true
  fi
}

compose pull "${services[@]}"
run_candidate_with_rollback deploy_candidate verify_candidate rollback_application

ln -sfn "${release_dir}" "${APP_ROOT}/current.next"
mv -Tf "${APP_ROOT}/current.next" "${APP_ROOT}/current"
echo "Deployed release $(basename "${release_dir}") with pre-migration backup ${backup}."
