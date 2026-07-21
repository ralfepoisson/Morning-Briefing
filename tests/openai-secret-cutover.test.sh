#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cutover_script="${ROOT_DIR}/cicd/host/migrate-openai-secret.sh"
TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/morning-briefing-openai-cutover.XXXXXX")"
container_id=''
cleanup() {
  if [[ -n "${container_id}" ]]; then
    docker rm -f "${container_id}" >/dev/null 2>&1 || true
  fi
  rm -rf "${TEST_TMP}"
}
trap cleanup EXIT

[[ -x "${cutover_script}" ]] || { echo 'OpenAI secret cutover utility is missing' >&2; exit 1; }
grep -Fq "count(DISTINCT openai_api_key)" "${cutover_script}"
grep -Fq "pg_dump --format=custom" "${cutover_script}"
grep -Fq "TenantAiConfigurationService" "${cutover_script}"
grep -Fq "hasOpenAiApiKey" "${cutover_script}"
grep -Fq "SET openai_api_key = NULL" "${cutover_script}"
grep -Fq "assert_secret_file_mode" "${cutover_script}"
grep -Fq "octet_length(openai_api_key)" "${cutover_script}"
install_line="$(grep -n '^installed=true$' "${cutover_script}" | cut -d: -f1)"
verify_line="$(grep -n '^verify_application_status ||' "${cutover_script}" | cut -d: -f1)"
backup_line="$(grep -n '^create_database_backup ' "${cutover_script}" | tail -n 1 | cut -d: -f1)"
clear_line="$(grep -n '^clear_legacy_secret$' "${cutover_script}" | cut -d: -f1)"
[[ "${install_line}" -lt "${verify_line}" && "${verify_line}" -lt "${backup_line}" && "${backup_line}" -lt "${clear_line}" ]]

fixture="${TEST_TMP}/fixture"
mkdir -p \
  "${fixture}/app/secrets" \
  "${fixture}/app/locks" \
  "${fixture}/release/scripts/lib" \
  "${fixture}/release/cicd/host" \
  "${fixture}/state"
cp "${cutover_script}" "${fixture}/release/cicd/host/migrate-openai-secret.sh"
cp "${ROOT_DIR}/scripts/lib/release-common.sh" "${fixture}/release/scripts/lib/release-common.sh"
printf '%s\n' 'DATABASE_URL=postgresql://fixture.invalid/backend' > "${fixture}/app/secrets/backend.env"
printf '%s\n' 'DATABASE_URL=postgresql://fixture.invalid/worker' > "${fixture}/app/secrets/worker.env"
awk 'BEGIN { for (i = 0; i < 164; i++) printf "x"; printf "\n" }' > "${fixture}/state/legacy-openai-key"
printf '%s\n' 'fixture database backup payload' > "${fixture}/state/database-backup.fixture"
chmod 0600 "${fixture}/app/secrets/backend.env" "${fixture}/app/secrets/worker.env"

container_id="$(docker create -i --platform linux/arm64 \
  --entrypoint bash \
  node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d \
  -se)"
docker cp "${fixture}/." "${container_id}:/fixture/"
docker start -ai "${container_id}" <<'CONTAINER_TEST'
set -euo pipefail
chmod 0600 /fixture/app/secrets/backend.env /fixture/app/secrets/worker.env
chown root:root /fixture/app/secrets/backend.env /fixture/app/secrets/worker.env

dry_output="$(
  APP_ROOT=/fixture/app \
  OPENAI_CUTOVER_FIXTURE_ROOT=/fixture/state \
  OPENAI_CUTOVER_ALLOW_FIXTURE=true \
  /fixture/release/cicd/host/migrate-openai-secret.sh /fixture/release --dry-run 2>&1
)"
[[ "${dry_output}" != *'xxxxxxxxxxxxxxxx'* ]]
[[ -s /fixture/state/legacy-openai-key ]]
! grep -q '^OPENAI_API_KEY=' /fixture/app/secrets/backend.env
! grep -q '^OPENAI_API_KEY=' /fixture/app/secrets/worker.env

cutover_output="$(
  APP_ROOT=/fixture/app \
  OPENAI_CUTOVER_FIXTURE_ROOT=/fixture/state \
  OPENAI_CUTOVER_ALLOW_FIXTURE=true \
  /fixture/release/cicd/host/migrate-openai-secret.sh /fixture/release 2>&1
)"
[[ "${cutover_output}" != *'xxxxxxxxxxxxxxxx'* ]]
[[ ! -s /fixture/state/legacy-openai-key ]]
[[ "$(stat -c '%a:%u:%g' /fixture/app/secrets/backend.env)" == '600:0:0' ]]
[[ "$(stat -c '%a:%u:%g' /fixture/app/secrets/worker.env)" == '600:0:0' ]]
grep -Eq '^OPENAI_API_KEY=x{164}$' /fixture/app/secrets/backend.env
grep -Eq '^OPENAI_API_KEY=x{164}$' /fixture/app/secrets/worker.env
backup="$(find /fixture/app/backups -type f -name 'pre-openai-secret-*.dump' -print -quit)"
[[ -n "${backup}" && -s "${backup}" ]]
[[ "$(sha256sum "${backup}" | awk '{print $1}')" == "$(tr -d '[:space:]' < "${backup}.sha256")" ]]
CONTAINER_TEST

echo 'ok - OpenAI cutover fixture validates dry-run secrecy and the atomic backup/install/verify/clear transaction'
