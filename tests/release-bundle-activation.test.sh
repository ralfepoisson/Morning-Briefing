#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/morning-briefing-bundle-activation.XXXXXX")"
container_id=''
cleanup() {
  if [[ -n "${container_id}" ]]; then
    docker rm -f "${container_id}" >/dev/null 2>&1 || true
  fi
  rm -rf "${TEST_TMP}"
}
trap cleanup EXIT
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
find "${BUNDLE_ROOT}" -exec touch -t 197001010000 {} +
COPYFILE_DISABLE=1 tar -C "${BUNDLE_ROOT}" -cf - . | gzip -n > "${bundle}"
archive_listing="$(tar -tzf "${bundle}")"
grep -Fqx './cicd/' <<< "${archive_listing}"
grep -Fqx './scripts/' <<< "${archive_listing}"
bundle_sha="$(shasum -a 256 "${bundle}" | awk '{print $1}')"

CONTAINER_INPUT="${TEST_TMP}/container-input"
mkdir -p "${CONTAINER_INPUT}/workspace/cicd/host" "${CONTAINER_INPUT}/fixture"
cp "${ROOT_DIR}/cicd/host/activate-release-bundle.sh" "${CONTAINER_INPUT}/workspace/cicd/host/activate-release-bundle.sh"
cp "${bundle}" "${CONTAINER_INPUT}/fixture/release-bundle.tar.gz"
container_id="$(docker create -i --platform linux/arm64 \
  --entrypoint bash \
  node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d \
  -se -- "${bundle_sha}" "${GIT_SHA}")"
docker cp "${CONTAINER_INPUT}/." "${container_id}:/"
docker start -ai "${container_id}" <<'CONTAINER_TEST'
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

assert_rejected() {
  local name="$1"
  local rejected_bundle="$2"
  local expected_error="$3"
  local app_root="/srv-test/rejected-${name}"
  local rejected_sha
  local output
  rejected_sha="$(sha256sum "${rejected_bundle}" | awk '{print $1}')"
  if output="$(APP_ROOT="${app_root}" /workspace/cicd/host/activate-release-bundle.sh \
    "${rejected_bundle}" "${rejected_sha}" "${expected_git_sha}" 2>&1)"; then
    echo "${name} bundle was accepted" >&2
    exit 1
  fi
  [[ "${output}" == *"${expected_error}"* ]]
  [[ ! -e "${app_root}/releases/${expected_git_sha}" ]]
  echo "ok - root activation rejects ${name} archive members before release installation"
}

make_stage() {
  local name="$1"
  local stage="/home/ralfe/.morning-briefing-release.${name}"
  mkdir -p "${stage}"
  chmod 0700 "${stage}"
  printf '%s\n' "${stage}/release-bundle.tar.gz"
}

mkdir -p /malicious/unexpected /malicious/release.env
touch /malicious/safe

unexpected_bundle="$(make_stage unexpected)"
tar -czf "${unexpected_bundle}" -C /malicious unexpected
chmod 0600 "${unexpected_bundle}"
assert_rejected unexpected "${unexpected_bundle}" 'Release bundle contains an unexpected path: unexpected/'

file_as_directory_bundle="$(make_stage file-as-directory)"
tar -czf "${file_as_directory_bundle}" -C /malicious release.env
chmod 0600 "${file_as_directory_bundle}"
assert_rejected file-as-directory "${file_as_directory_bundle}" 'Release bundle contains an unexpected path: release.env/'

traversal_bundle="$(make_stage traversal)"
tar -czf "${traversal_bundle}" -C /malicious --transform='s|safe|../escape|' safe
chmod 0600 "${traversal_bundle}"
assert_rejected traversal "${traversal_bundle}" 'Release bundle contains an unsafe path.'

absolute_bundle="$(make_stage absolute)"
tar -czf "${absolute_bundle}" -C /malicious --transform='s|safe|/absolute|' safe
chmod 0600 "${absolute_bundle}"
assert_rejected absolute "${absolute_bundle}" 'Release bundle contains an unsafe path.'

ln -s safe /malicious/cicd
symlink_bundle="$(make_stage symlink)"
tar -czf "${symlink_bundle}" -C /malicious cicd
chmod 0600 "${symlink_bundle}"
assert_rejected symlink "${symlink_bundle}" 'Release bundle must not contain links.'

touch /malicious/scripts
ln /malicious/scripts /malicious/cicd-hardlink
hardlink_bundle="$(make_stage hardlink)"
tar -czf "${hardlink_bundle}" -C /malicious --transform='s|cicd-hardlink|cicd|' scripts cicd-hardlink
chmod 0600 "${hardlink_bundle}"
assert_rejected hardlink "${hardlink_bundle}" 'Release bundle must not contain links.'

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
