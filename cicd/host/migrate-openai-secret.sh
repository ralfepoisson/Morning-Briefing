#!/usr/bin/env bash
set -euo pipefail
set +x
umask 0077

APP_ROOT="${APP_ROOT:-/srv/apps/morning-briefing}"
release_dir="${1:-}"
mode="${2:-}"
[[ -n "${release_dir}" ]] || { echo "Usage: migrate-openai-secret.sh <absolute-release-directory> [--dry-run]" >&2; exit 2; }
[[ "${mode}" == "" || "${mode}" == "--dry-run" ]] || { echo "Unknown cutover mode." >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo "OpenAI secret cutover must run through the root boundary." >&2; exit 1; }
release_dir="$(cd "${release_dir}" && pwd)"

# shellcheck source=../../../scripts/lib/release-common.sh
source "${release_dir}/scripts/lib/release-common.sh"
acquire_deploy_lock "${APP_ROOT}/locks/deploy.lock"

backend_secret="${APP_ROOT}/secrets/backend.env"
worker_secret="${APP_ROOT}/secrets/worker.env"
assert_secret_file_mode "${backend_secret}"
assert_secret_file_mode "${worker_secret}"
install -d -o root -g root -m 0750 "${APP_ROOT}/backups"

postgres_container="${POSTGRES_CONTAINER:-postgres}"
postgres_database="${POSTGRES_DATABASE:-morning_briefing}"
fixture_root="${OPENAI_CUTOVER_FIXTURE_ROOT:-}"
expected_key_length="${EXPECTED_OPENAI_KEY_LENGTH:-164}"
[[ "${expected_key_length}" =~ ^[0-9]+$ && "${expected_key_length}" -gt 0 ]] \
  || die "EXPECTED_OPENAI_KEY_LENGTH is invalid."
if [[ -n "${fixture_root}" ]]; then
  [[ "${OPENAI_CUTOVER_ALLOW_FIXTURE:-false}" == "true" && "${APP_ROOT}" == /fixture/* ]] \
    || die "Fixture mode is restricted to the isolated contract test."
fi

database_summary() {
  if [[ -n "${fixture_root}" ]]; then
    if [[ -s "${fixture_root}/legacy-openai-key" ]]; then
      fixture_length="$(awk 'NR == 1 { print length($0) }' "${fixture_root}/legacy-openai-key")"
      printf '1|1|1|%s|%s\n' "${fixture_length}" "${fixture_length}"
    else
      printf '1|0|0|0|0\n'
    fi
    return
  fi
  docker exec -u postgres "${postgres_container}" psql --dbname="${postgres_database}" --tuples-only --no-align \
    --command="SELECT count(*) || '|' || count(openai_api_key) || '|' || count(DISTINCT openai_api_key) || '|' || COALESCE(min(octet_length(openai_api_key))::text, '0') || '|' || COALESCE(max(octet_length(openai_api_key))::text, '0') FROM tenant_ai_configurations;"
}

create_database_backup() {
  local container_backup="$1"
  local host_backup="$2"
  if [[ -n "${fixture_root}" ]]; then
    install -o root -g root -m 0600 "${fixture_root}/database-backup.fixture" "${host_backup}"
    return
  fi
  docker exec -u postgres "${postgres_container}" pg_dump --format=custom --dbname="${postgres_database}" --file="${container_backup}"
  docker cp "${postgres_container}:${container_backup}" "${host_backup}" >/dev/null
  docker exec -u postgres "${postgres_container}" rm -f "${container_backup}"
  chown root:root "${host_backup}"
  chmod 0600 "${host_backup}"
}

export_legacy_secret() {
  local container_secret="$1"
  local host_secret="$2"
  if [[ -n "${fixture_root}" ]]; then
    install -o root -g root -m 0600 "${fixture_root}/legacy-openai-key" "${host_secret}"
    return
  fi
  docker exec -u postgres "${postgres_container}" psql --dbname="${postgres_database}" --set=ON_ERROR_STOP=1 \
    --command="COPY (SELECT openai_api_key FROM tenant_ai_configurations) TO '${container_secret}';" >/dev/null
  docker cp "${postgres_container}:${container_secret}" "${host_secret}" >/dev/null
  docker exec -u postgres "${postgres_container}" rm -f "${container_secret}"
  chown root:root "${host_secret}"
  chmod 0600 "${host_secret}"
}

clear_legacy_secret() {
  if [[ -n "${fixture_root}" ]]; then
    : > "${fixture_root}/legacy-openai-key"
    return
  fi
  docker exec -u postgres "${postgres_container}" psql --dbname="${postgres_database}" --set=ON_ERROR_STOP=1 \
    --command="UPDATE tenant_ai_configurations SET openai_api_key = NULL WHERE openai_api_key IS NOT NULL;" >/dev/null
}

verify_application_status() {
  if [[ -n "${fixture_root}" ]]; then
    grep -Eq '^OPENAI_API_KEY=[A-Za-z0-9._-]+$' "${backend_secret}"
    grep -Eq '^OPENAI_API_KEY=[A-Za-z0-9._-]+$' "${worker_secret}"
    return
  fi
  local service
  for service in backend worker; do
    docker compose --project-name morning-briefing \
      --env-file "${release_dir}/release.env" \
      -f "${release_dir}/cicd/compose/compose.yaml" \
      run --rm --no-deps "${service}" \
      node --input-type=module --eval '
        const { TenantAiConfigurationService } = await import("./dist/src/modules/tenant-ai-configuration/tenant-ai-configuration-service.js");
        const repository = { findByTenantId: async () => null };
        const result = await new TenantAiConfigurationService(repository, process.env).getConfiguration("00000000-0000-0000-0000-000000000000");
        if (result.hasOpenAiApiKey !== true) process.exit(1);
      ' >/dev/null
  done
}

summary="$(database_summary | tr -d '[:space:]')"
[[ "${summary}" == "1|1|1|${expected_key_length}|${expected_key_length}" ]] \
  || die "Expected exactly one tenant AI configuration row with one non-null distinct legacy key of the approved length."
if [[ "${mode}" == "--dry-run" ]]; then
  echo "OpenAI secret cutover dry run passed; no secret or database value was changed."
  exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
container_backup="/tmp/morning-briefing-pre-openai-${timestamp}-$$.dump"
host_backup="${APP_ROOT}/backups/pre-openai-secret-${timestamp}-$$.dump"
stage="$(mktemp -d "${APP_ROOT}/secrets/.openai-cutover.XXXXXXXX")"
container_secret="/tmp/morning-briefing-openai-${timestamp}-$$.value"
installed=false
legacy_cleared=false
cleanup() {
  local exit_code=$?
  if [[ -z "${fixture_root}" ]]; then
    docker exec -u postgres "${postgres_container}" rm -f "${container_secret}" "${container_backup}" >/dev/null 2>&1 || true
  fi
  if [[ "${exit_code}" -ne 0 && "${installed}" == "true" && "${legacy_cleared}" != "true" ]]; then
    for name in backend worker; do
      install -o root -g root -m 0600 "${stage}/${name}.original" "${APP_ROOT}/secrets/.${name}.env.restore"
      mv -f "${APP_ROOT}/secrets/.${name}.env.restore" "${APP_ROOT}/secrets/${name}.env"
    done
  fi
  for name in backend worker; do
    for leftover in "${APP_ROOT}/secrets/.${name}.env.openai-next" "${APP_ROOT}/secrets/.${name}.env.restore"; do
      if [[ -f "${leftover}" && ! -L "${leftover}" ]]; then
        unlink "${leftover}"
      fi
    done
  done
  if [[ -d "${stage}" ]]; then
    find "${stage}" -mindepth 1 -delete
    rmdir "${stage}"
  fi
  exit "${exit_code}"
}
trap cleanup EXIT

install -o root -g root -m 0600 "${backend_secret}" "${stage}/backend.original"
install -o root -g root -m 0600 "${worker_secret}" "${stage}/worker.original"
export_legacy_secret "${container_secret}" "${stage}/openai.value"
[[ "$(awk 'END { print NR }' "${stage}/openai.value")" == "1" ]] \
  || die "Legacy OpenAI key is not a single environment-safe line."
grep -Eq '^[A-Za-z0-9._-]+$' "${stage}/openai.value" \
  || die "Legacy OpenAI key contains characters that are unsafe for an environment file."
[[ "$(awk 'NR == 1 { print length($0) }' "${stage}/openai.value")" == "${expected_key_length}" ]] \
  || die "Exported OpenAI key length does not match the approved preflight evidence."

installed=true
for name in backend worker; do
  awk '!/^OPENAI_API_KEY=/' "${stage}/${name}.original" > "${stage}/${name}.next"
  printf 'OPENAI_API_KEY=' >> "${stage}/${name}.next"
  dd if="${stage}/openai.value" bs=65536 >> "${stage}/${name}.next" 2>/dev/null
  chmod 0600 "${stage}/${name}.next"
  install -o root -g root -m 0600 "${stage}/${name}.next" "${APP_ROOT}/secrets/.${name}.env.openai-next"
  mv -f "${APP_ROOT}/secrets/.${name}.env.openai-next" "${APP_ROOT}/secrets/${name}.env"
done
assert_secret_file_mode "${backend_secret}"
assert_secret_file_mode "${worker_secret}"
verify_application_status || die "Application configuration status did not report hasOpenAiApiKey=true."

create_database_backup "${container_backup}" "${host_backup}"
[[ -s "${host_backup}" ]] || die "Pre-clear PostgreSQL backup is empty."
sha256_file "${host_backup}" > "${host_backup}.sha256"
chown root:root "${host_backup}.sha256"
chmod 0600 "${host_backup}.sha256"
[[ "$(tr -d '[:space:]' < "${host_backup}.sha256")" == "$(sha256_file "${host_backup}")" ]] \
  || die "Pre-clear PostgreSQL backup checksum verification failed."

clear_legacy_secret
legacy_cleared=true
post_summary="$(database_summary | tr -d '[:space:]')"
[[ "${post_summary}" == "1|0|0|0|0" ]] || die "Legacy OpenAI key clear postcondition failed."

trap - EXIT
find "${stage}" -mindepth 1 -delete
rmdir "${stage}"
echo "OpenAI secret cutover completed; protected runtime files are active and the legacy column is clear."
