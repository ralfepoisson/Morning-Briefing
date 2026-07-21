#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/morning-briefing-bundle-activation.XXXXXX")"
trap 'rm -rf "${TEST_TMP}"' EXIT
BUNDLE_ROOT="${TEST_TMP}/bundle-root"
GIT_SHA="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
mkdir -p "${BUNDLE_ROOT}/cicd/compose" "${BUNDLE_ROOT}/cicd/host" "${BUNDLE_ROOT}/scripts/lib"
cp "${ROOT_DIR}/cicd/compose/compose.yaml" "${BUNDLE_ROOT}/cicd/compose/compose.yaml"
cp "${ROOT_DIR}/scripts/lib/release-common.sh" "${BUNDLE_ROOT}/scripts/lib/release-common.sh"

cat > "${BUNDLE_ROOT}/cicd/host/deploy.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
release_dir="$1"
[[ "$(id -u)" -eq 0 ]]
[[ "$(stat -c '%U:%G' "${release_dir}")" == 'root:root' ]]
[[ "$(stat -c '%a' "${release_dir}")" == 750 ]]
[[ "$(stat -c '%a' "${release_dir}/.release-bundle.sha256")" == 640 ]]
echo 'activation marker reached through root-owned release'
SH
chmod +x "${BUNDLE_ROOT}/cicd/host/deploy.sh"

compose_sha="$(shasum -a 256 "${BUNDLE_ROOT}/cicd/compose/compose.yaml" | awk '{print $1}')"
jq -n --arg gitSha "${GIT_SHA}" --arg composeSha "${compose_sha}" \
  '{schemaVersion:1,application:"morning-briefing",gitSha:$gitSha,awsAccount:"154596858576",region:"eu-west-1",images:{backend:"example.invalid/backend@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",frontend:"example.invalid/frontend@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"},composeSha256:$composeSha,migrationId:"test-migration",createdAt:"2026-07-21T04:00:00Z"}' \
  > "${BUNDLE_ROOT}/release-manifest.json"
cat > "${BUNDLE_ROOT}/release.env" <<'ENV'
APP_ROOT=/srv/apps/morning-briefing
ENV

bundle="${TEST_TMP}/release-bundle.tar.gz"
tar -C "${BUNDLE_ROOT}" -czf "${bundle}" .
bundle_sha="$(shasum -a 256 "${bundle}" | awk '{print $1}')"

docker run --rm --platform linux/arm64 \
  --volume "${ROOT_DIR}:/workspace:ro" \
  --volume "${bundle}:/fixture/release-bundle.tar.gz:ro" \
  --entrypoint bash \
  node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d \
  -se -- "${bundle_sha}" "${GIT_SHA}" <<'CONTAINER_TEST'
set -euo pipefail
expected_bundle_sha="$1"
expected_git_sha="$2"
apt-get update -qq
apt-get install -y -qq jq >/dev/null
user_stage='/home/ralfe/.morning-briefing-release.activation-test'
mkdir -p "${user_stage}"
cp /fixture/release-bundle.tar.gz "${user_stage}/release-bundle.tar.gz"
chown -R 20001:20001 /home/ralfe
chmod 0700 "${user_stage}"
chmod 0600 "${user_stage}/release-bundle.tar.gz"

if APP_ROOT=/srv-test/morning /workspace/cicd/host/activate-release-bundle.sh \
  "${user_stage}/release-bundle.tar.gz" \
  aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  "${expected_git_sha}" >/dev/null 2>&1; then
  echo 'tampered checksum was accepted' >&2
  exit 1
fi

output="$(APP_ROOT=/srv-test/morning /workspace/cicd/host/activate-release-bundle.sh \
  "${user_stage}/release-bundle.tar.gz" "${expected_bundle_sha}" "${expected_git_sha}")"
[[ "${output}" == *'activation marker reached through root-owned release'* ]]
CONTAINER_TEST

echo 'ok - root activation rejects checksum tampering and installs a verified root-owned release'
