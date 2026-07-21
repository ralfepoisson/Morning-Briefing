#!/usr/bin/env bash
set -euo pipefail
umask 0077

APP_ROOT="${APP_ROOT:-/srv/apps/morning-briefing}"
bundle_path="${1:-}"
expected_bundle_sha="${2:-}"
expected_git_sha="${3:-}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ "$(id -u)" -eq 0 ]] || die "Release activation must run as root."
[[ "${bundle_path}" =~ ^/home/[A-Za-z0-9._-]+/\.morning-briefing-release\.[A-Za-z0-9._-]+/release-bundle\.tar\.gz$ ]] \
  || die "Release bundle path is outside protected user staging."
[[ "${expected_bundle_sha}" =~ ^[0-9a-f]{64}$ ]] || die "Release bundle checksum is invalid."
[[ "${expected_git_sha}" =~ ^[0-9a-f]{40}$ ]] || die "Release Git SHA is invalid."
[[ -f "${bundle_path}" && ! -L "${bundle_path}" ]] || die "Release bundle is missing or is a symbolic link."

if [[ "${APP_ROOT}" == /srv/apps/* ]]; then
  [[ "$(stat -c '%a' /srv/apps)" == 700 ]] || die "/srv/apps must remain mode 0700."
fi
install -d -o root -g root -m 0750 "${APP_ROOT}/releases"
root_bundle="$(mktemp "${APP_ROOT}/releases/.bundle-${expected_git_sha}.XXXXXXXX")"
cleanup_root_bundle() {
  [[ ! -e "${root_bundle}" ]] || unlink "${root_bundle}"
}
trap cleanup_root_bundle EXIT
install -o root -g root -m 0600 "${bundle_path}" "${root_bundle}"

if command -v sha256sum >/dev/null 2>&1; then
  actual_bundle_sha="$(sha256sum "${root_bundle}" | awk '{print $1}')"
else
  actual_bundle_sha="$(shasum -a 256 "${root_bundle}" | awk '{print $1}')"
fi
[[ "${actual_bundle_sha}" == "${expected_bundle_sha}" ]] || die "Release bundle checksum mismatch."

while IFS= read -r archive_path; do
  archive_path="${archive_path#./}"
  [[ -z "${archive_path}" ]] && continue
  [[ "${archive_path}" != /* && "/${archive_path}/" != *'/../'* ]] \
    || die "Release bundle contains an unsafe path."
  case "${archive_path}" in
    cicd|cicd/compose|cicd/compose/*|cicd/host|cicd/host/*|scripts|scripts/lib|scripts/lib/*|release-manifest.json|release.env) ;;
    *) die "Release bundle contains an unexpected path: ${archive_path}" ;;
  esac
done < <(tar -tzf "${root_bundle}")
if tar -tvzf "${root_bundle}" | grep -Eq '^[lh]'; then
  die "Release bundle must not contain links."
fi

incoming="$(mktemp -d "${APP_ROOT}/releases/.incoming-${expected_git_sha}.XXXXXXXX")"
cleanup_incoming() {
  if [[ -d "${incoming}" ]]; then
    find "${incoming}" -mindepth 1 -delete
    rmdir "${incoming}"
  fi
}
trap 'cleanup_incoming; cleanup_root_bundle' EXIT

tar --no-same-owner --no-same-permissions -xzf "${root_bundle}" -C "${incoming}"
if find "${incoming}" -type l -print -quit | grep -q .; then
  die "Release bundle must not contain symbolic links."
fi
chown -R root:root "${incoming}"
find "${incoming}" -type d -exec chmod 0750 {} +
find "${incoming}" -type f -exec chmod 0640 {} +
find "${incoming}/cicd/host" "${incoming}/scripts/lib" -type f -name '*.sh' -exec chmod 0750 {} +

# shellcheck source=../../../scripts/lib/release-common.sh
source "${incoming}/scripts/lib/release-common.sh"
validate_release_manifest "${incoming}/release-manifest.json" || die "Release manifest validation failed."
[[ "$(jq -r '.gitSha' "${incoming}/release-manifest.json")" == "${expected_git_sha}" ]] \
  || die "Release manifest Git SHA does not match the requested release."
expected_compose_sha="$(jq -r '.composeSha256' "${incoming}/release-manifest.json")"
[[ "$(sha256_file "${incoming}/cicd/compose/compose.yaml")" == "${expected_compose_sha}" ]] \
  || die "Release Compose checksum mismatch."
printf '%s\n' "${expected_bundle_sha}" > "${incoming}/.release-bundle.sha256"
chmod 0640 "${incoming}/.release-bundle.sha256"

release_dir="${APP_ROOT}/releases/${expected_git_sha}"
if [[ -e "${release_dir}" ]]; then
  [[ -f "${release_dir}/.release-bundle.sha256" ]] || die "Existing release has no bundle checksum marker."
  [[ "$(tr -d '[:space:]' < "${release_dir}/.release-bundle.sha256")" == "${expected_bundle_sha}" ]] \
    || die "Existing immutable release differs from the staged bundle."
  cleanup_incoming
else
  mv "${incoming}" "${release_dir}"
fi

cleanup_root_bundle
trap - EXIT
exec "${release_dir}/cicd/host/deploy.sh" "${release_dir}"
