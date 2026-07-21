#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/morning-briefing-release-tests.XXXXXX")"
trap 'rm -rf "${TEST_TMP}"' EXIT

fail() {
  echo "not ok - $1" >&2
  exit 1
}

assert_fails() {
  local description="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    fail "${description}"
  fi
  echo "ok - ${description}"
}

assert_succeeds() {
  local description="$1"
  shift
  if ! "$@" >/dev/null 2>&1; then
    fail "${description}"
  fi
  echo "ok - ${description}"
}

# shellcheck source=../scripts/lib/release-common.sh
source "${ROOT_DIR}/scripts/lib/release-common.sh"

assert_fails "rejects mutable image tags" validate_digest_ref "example.invalid/app:latest"
assert_fails "rejects malformed digests" validate_digest_ref "example.invalid/app@sha256:1234"
assert_succeeds "accepts immutable image digests" validate_digest_ref "154596858576.dkr.ecr.eu-west-1.amazonaws.com/app@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

manifest="${TEST_TMP}/release.json"
cat > "${manifest}" <<'JSON'
{
  "schemaVersion": 1,
  "application": "morning-briefing",
  "gitSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "awsAccount": "154596858576",
  "region": "eu-west-1",
  "images": {
    "backend": "154596858576.dkr.ecr.eu-west-1.amazonaws.com/backend@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "frontend": "154596858576.dkr.ecr.eu-west-1.amazonaws.com/frontend@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  },
  "composeSha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "migrationId": "20260329064000_add_user_preferred_language",
  "createdAt": "2026-07-20T12:00:00Z"
}
JSON

assert_succeeds "accepts a valid release manifest" validate_release_manifest "${manifest}"
jq '.images.backend = "example.invalid/backend:latest"' "${manifest}" > "${TEST_TMP}/mutable.json"
assert_fails "rejects a manifest containing mutable images" validate_release_manifest "${TEST_TMP}/mutable.json"
jq '.awsAccount = "000000000000"' "${manifest}" > "${TEST_TMP}/wrong-account.json"
assert_fails "rejects the wrong AWS account" validate_release_manifest "${TEST_TMP}/wrong-account.json"

repo="${TEST_TMP}/repo"
mkdir -p "${repo}"
git -C "${repo}" init -q
git -C "${repo}" config user.email test@example.invalid
git -C "${repo}" config user.name Test
git -C "${repo}" remote add origin https://github.com/ralfepoisson/Morning-Briefing.git
touch "${repo}/tracked"
git -C "${repo}" add tracked
git -C "${repo}" commit -qm initial
assert_succeeds "accepts repository identity in an isolated worktree path" require_repository_identity "${repo}"
assert_succeeds "accepts a local committed release branch for CI" require_release_commit "${repo}"
assert_fails "rejects an unpushed release commit for publication" require_pushed_release_commit "${repo}"
release_branch="$(git -C "${repo}" branch --show-current)"
git -C "${repo}" update-ref "refs/remotes/origin/${release_branch}" "$(git -C "${repo}" rev-parse HEAD)"
assert_succeeds "accepts a pushed release commit for publication" require_pushed_release_commit "${repo}"
grep -q 'require_pushed_release_commit' "${ROOT_DIR}/scripts/publish-release.sh" || fail "publication does not enforce a pushed release commit"
echo "ok - publication alone enforces the pushed release gate"
assert_succeeds "accepts a clean release worktree" require_clean_worktree "${repo}"
echo dirty > "${repo}/tracked"
assert_fails "rejects a dirty release worktree" require_clean_worktree "${repo}"

mkdir -p "${TEST_TMP}/bin"
cat > "${TEST_TMP}/bin/flock" <<'SH'
#!/usr/bin/env bash
exit 1
SH
chmod +x "${TEST_TMP}/bin/flock"
assert_fails "rejects overlapping deployment locks" env PATH="${TEST_TMP}/bin:${PATH}" bash -c 'source "$1"; acquire_deploy_lock "$2"' _ "${ROOT_DIR}/scripts/lib/release-common.sh" "${TEST_TMP}/deploy.lock"

rollback_marker="${TEST_TMP}/rollback-invoked"
deploy_ok() { return 0; }
health_fails() { return 1; }
rollback_marks() { touch "${rollback_marker}"; }
assert_fails "failed health returns a failed release" run_candidate_with_rollback deploy_ok health_fails rollback_marks
[[ -f "${rollback_marker}" ]] || fail "failed health did not invoke rollback"
echo "ok - failed health invokes rollback"

grep -q 'OnCalendar=\*-\*-\* 01:00:00 UTC' "${ROOT_DIR}/cicd/host/systemd/morning-briefing-snapshot-refresh.timer" || fail "snapshot timer is not exact"
grep -q 'OnCalendar=\*-\*-\* 05:00:00 UTC' "${ROOT_DIR}/cicd/host/systemd/morning-briefing-dashboard-audio-refresh.timer" || fail "audio timer is not exact"
echo "ok - exact UTC schedules are preserved"

for service in \
  morning-briefing-snapshot-refresh.service \
  morning-briefing-dashboard-audio-refresh.service; do
  service_file="${ROOT_DIR}/cicd/host/systemd/${service}"
  grep -Fqx 'User=root' "${service_file}" || fail "${service} does not use the root-owned oneshot boundary"
  grep -Fqx 'Group=root' "${service_file}" || fail "${service} does not use the root group boundary"
  grep -Fqx 'UMask=0077' "${service_file}" || fail "${service} does not preserve private created-file modes"
  grep -Fqx 'NoNewPrivileges=true' "${service_file}" || fail "${service} does not prevent privilege escalation"
done
grep -Fq 'install-systemd-units.sh' "${ROOT_DIR}/cicd/host/deploy.sh" || fail "deployments do not preserve the systemd permission model"
grep -Fq 'install -o root -g root -m 0644' "${ROOT_DIR}/cicd/host/install-systemd-units.sh" || fail "systemd units are not installed with root-only ownership changes"
grep -Fq 'systemctl daemon-reload' "${ROOT_DIR}/cicd/host/install-systemd-units.sh" || fail "systemd is not reloaded after unit installation"
if rg -n 'systemctl (enable|start|restart)|systemctl .*--now' "${ROOT_DIR}/cicd/host/install-systemd-units.sh" >/dev/null; then
  fail "unit installation changes timer enablement before writer handoff"
fi
echo "ok - scheduled jobs use a deployment-preserved root oneshot boundary"

grep -Fq 'Deployment must run through the root activation boundary.' "${ROOT_DIR}/cicd/host/deploy.sh" || fail "host deployment is not restricted to the root activation boundary"
grep -Fq 'install -d -m 0750 "${APP_ROOT}/data/audio"' "${ROOT_DIR}/cicd/host/deploy.sh" || fail "host data directory is not created securely"
grep -Fq 'chown 10001:10001 "${APP_ROOT}/data/audio"' "${ROOT_DIR}/cicd/host/deploy.sh" || fail "host data ownership is not expressed as numeric UID/GID"
echo "ok - host data ownership uses numeric UID and GID"

grep -Fq 'sudo -n /srv/apps/morning-briefing/current/cicd/host/rollback.sh' "${ROOT_DIR}/scripts/rollback.sh" || fail "rollback cannot traverse the root-owned application path"
grep -Fq 'acquire_deploy_lock "${APP_ROOT}/locks/deploy.lock"' "${ROOT_DIR}/cicd/host/rollback.sh" || fail "root-bound rollback does not preserve deployment locking"
echo "ok - rollback uses the non-interactive root boundary and retains locking"

grep -Fq 'backend_ready="$(wait_for_http http://127.0.0.1:13000/health/ready)"' "${ROOT_DIR}/cicd/host/health-check.sh" || fail "backend host-port readiness is not retried"
grep -Fq 'wait_for_http http://127.0.0.1:18080/healthz >/dev/null' "${ROOT_DIR}/cicd/host/health-check.sh" || fail "frontend host-port readiness is not retried"
echo "ok - host-port readiness probes are bounded and retried"

awk '/^  frontend:/{inside=1} /^  backend:/{inside=0} inside && /- host-port/{found=1} END{exit !found}' "${ROOT_DIR}/cicd/compose/compose.yaml" || fail "frontend is not attached to the host-port bridge"
grep -Fq '  host-port: {}' "${ROOT_DIR}/cicd/compose/compose.yaml" || fail "host-port bridge is not declared"
echo "ok - frontend loopback publishing has a non-internal bridge"

if rg -g '!**/node_modules/**' -e 'AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN).*(printf|echo)' -e 'source .*export_credentials' "${ROOT_DIR}/cicd" "${ROOT_DIR}/scripts" >/dev/null; then
  fail "credential-printing behavior remains"
fi
echo "ok - release tooling does not print or source raw AWS credentials"

grep -q 'src/backend" run typecheck:full' "${ROOT_DIR}/scripts/ci.sh" || fail "CI does not enforce the complete backend typecheck"
grep -Fq 'export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/morning_briefing?schema=public}"' "${ROOT_DIR}/scripts/ci.sh" || fail "CI relies on an ignored local database environment file"
grep -q 'npx prisma generate' "${ROOT_DIR}/scripts/ci.sh" || fail "CI does not generate the Prisma client before backend typechecking"
generate_line="$(grep -n 'npx prisma generate' "${ROOT_DIR}/scripts/ci.sh" | head -n 1 | cut -d: -f1)"
typecheck_line="$(grep -n 'run typecheck:full' "${ROOT_DIR}/scripts/ci.sh" | head -n 1 | cut -d: -f1)"
[[ "${generate_line}" -lt "${typecheck_line}" ]] || fail "CI generates the Prisma client after backend typechecking"
grep -q 'src/backend" run build' "${ROOT_DIR}/scripts/ci.sh" || fail "CI does not compile the backend production build"
grep -q 'src/backend" audit --omit=dev' "${ROOT_DIR}/scripts/ci.sh" || fail "CI does not enforce the backend production audit"
grep -q 'src/backend" audit$' "${ROOT_DIR}/scripts/ci.sh" || fail "CI does not enforce the complete backend audit"
grep -q 'src/web" test$' "${ROOT_DIR}/scripts/ci.sh" || fail "CI does not run frontend unit tests"
grep -q 'src/web" run test:container-config' "${ROOT_DIR}/scripts/ci.sh" || fail "CI does not validate frontend runtime configuration"
grep -q 'src/web" audit --omit=dev' "${ROOT_DIR}/scripts/ci.sh" || fail "CI does not enforce the frontend production audit"
grep -q 'src/web" audit$' "${ROOT_DIR}/scripts/ci.sh" || fail "CI does not enforce the complete frontend audit"
echo "ok - CI enforces complete type, build, unit, configuration, and audit gates"

"${ROOT_DIR}/tests/systemd-permission-model.test.sh"
"${ROOT_DIR}/tests/publish-transport.test.sh"
"${ROOT_DIR}/tests/release-bundle-activation.test.sh"

echo "deployment script tests passed"
