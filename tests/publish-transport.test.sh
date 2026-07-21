#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/morning-briefing-publish-transport.XXXXXX")"
trap 'rm -rf "${TEST_TMP}"' EXIT
FAKE_BIN="${TEST_TMP}/bin"
FAKE_LOG="${TEST_TMP}/transport.log"
mkdir -p "${FAKE_BIN}"
touch "${FAKE_LOG}"
export FAKE_LOG

cat > "${FAKE_BIN}/git" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
args=" $* "
case "${args}" in
  *" rev-parse --show-toplevel "*) pwd ;;
  *" remote get-url origin "*) echo 'https://github.com/ralfepoisson/Morning-Briefing.git' ;;
  *" status --porcelain "*) ;;
  *" rev-parse HEAD "*) echo 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' ;;
  *" show -s --format=%cI HEAD "*) echo '2026-07-21T06:00:00+02:00' ;;
  *" branch --show-current "*) echo 'codex/test-release' ;;
  *" merge-base --is-ancestor "*) exit 0 ;;
  *) echo "unexpected fake git invocation: $*" >&2; exit 1 ;;
esac
SH

cat > "${FAKE_BIN}/aws" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
case " $* " in
  *" sts get-caller-identity "*) echo '154596858576' ;;
  *" ecr get-login-password "*) echo 'fake-password' ;;
  *) echo "unexpected fake aws invocation: $*" >&2; exit 1 ;;
esac
SH

cat > "${FAKE_BIN}/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
case " $* " in
  *" login "*) cat >/dev/null ;;
  *" buildx build "*) ;;
  *" buildx imagetools inspect "*) printf '{"digest":"sha256:%064d"}\n' 0 ;;
  *) echo "unexpected fake docker invocation: $*" >&2; exit 1 ;;
esac
SH

cat > "${FAKE_BIN}/ssh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf 'ssh %s\n' "$*" >>"${FAKE_LOG}"
command_text="${*:2}"
if [[ "${command_text}" == *'/srv/apps/'* && "${command_text}" != *'sudo -n'* ]]; then
  echo 'install: cannot create directory: Permission denied' >&2
  exit 1
fi
if [[ "${command_text}" == *'mktemp -d'* ]]; then
  echo '/home/ralfe/.morning-briefing-release.test-stage'
fi
if [[ "${command_text}" == *'sudo -n bash -s'* ]]; then
  cat >/dev/null
fi
SH

cat > "${FAKE_BIN}/rsync" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
destination="${!#}"
printf 'rsync %s\n' "${destination}" >>"${FAKE_LOG}"
[[ " $* " == *' --chmod=F600 '* ]] || { echo 'staged bundle is not mode 0600' >&2; exit 1; }
[[ "${destination}" == personal-projects:/home/ralfe/.morning-briefing-release.test-stage/* ]] || {
  echo "rsync destination is not user-owned staging: ${destination}" >&2
  exit 1
}
SH

chmod +x "${FAKE_BIN}"/*

if ! PATH="${FAKE_BIN}:${PATH}" "${ROOT_DIR}/scripts/publish-release.sh" >"${TEST_TMP}/stdout" 2>"${TEST_TMP}/stderr"; then
  cat "${TEST_TMP}/stderr" >&2
  echo 'not ok - publisher cannot cross the protected host path through a staged sudo boundary' >&2
  exit 1
fi
first_bundle_sha="$(shasum -a 256 "${ROOT_DIR}/release-artifacts/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/release-bundle.tar.gz" | awk '{print $1}')"
PATH="${FAKE_BIN}:${PATH}" "${ROOT_DIR}/scripts/publish-release.sh" >"${TEST_TMP}/stdout-second" 2>"${TEST_TMP}/stderr-second"
second_bundle_sha="$(shasum -a 256 "${ROOT_DIR}/release-artifacts/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/release-bundle.tar.gz" | awk '{print $1}')"
[[ "${first_bundle_sha}" == "${second_bundle_sha}" ]] || {
  echo 'not ok - release bundle checksum is not reproducible for a retry of the same commit' >&2
  exit 1
}

grep -Fq 'rsync personal-projects:/home/ralfe/.morning-briefing-release.test-stage/' "${FAKE_LOG}"
grep -Fq 'sudo -n bash -s' "${FAKE_LOG}"
if rg -n 'ssh .*install -d .*\/srv\/apps|rsync .*\/srv\/apps' "${FAKE_LOG}" >/dev/null; then
  echo 'not ok - publisher still writes the protected release path as the login user' >&2
  exit 1
fi

echo 'ok - publisher stages as the login user and crosses /srv/apps only through sudo -n'
echo 'ok - repeated publication of one commit produces the same staged bundle checksum'
