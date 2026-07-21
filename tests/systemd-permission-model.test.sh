#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINUX_TEST_IMAGE="${LINUX_TEST_IMAGE:-node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d}"

docker run --rm --platform linux/arm64 \
  --volume "${ROOT_DIR}:/workspace:ro" \
  --entrypoint bash \
  "${LINUX_TEST_IMAGE}" -se <<'LINUX_TEST'
set -euo pipefail

install -d -o root -g root -m 0700 /srv/apps
install -d -o root -g root -m 0750 /srv/apps/morning-briefing
install -d -o root -g root -m 0750 /srv/apps/morning-briefing/releases
install -d -o root -g root -m 0750 /srv/apps/morning-briefing/releases/test-release
install -d -o root -g root -m 0750 /srv/apps/morning-briefing/releases/test-release/cicd/host
install -o root -g root -m 0755 \
  /workspace/cicd/host/run-scheduled-job.sh \
  /srv/apps/morning-briefing/releases/test-release/cicd/host/run-scheduled-job.sh
ln -s releases/test-release /srv/apps/morning-briefing/current

install -d -o root -g root -m 0700 /srv/apps/morning-briefing/secrets
install -o root -g root -m 0600 /dev/null /srv/apps/morning-briefing/secrets/backend.env
install -o root -g root -m 0600 /dev/null /srv/apps/morning-briefing/secrets/worker.env

useradd --uid 20001 --no-create-home --shell /usr/sbin/nologin ralfe
if runuser -u ralfe -- test -x /srv/apps/morning-briefing/current/cicd/host/run-scheduled-job.sh; then
  echo "not ok - unprivileged account unexpectedly traversed the root-owned application path" >&2
  exit 1
fi

test -x /srv/apps/morning-briefing/current/cicd/host/run-scheduled-job.sh
test "$(stat -c '%a' /srv/apps/morning-briefing/secrets/backend.env)" = 600
test "$(stat -c '%a' /srv/apps/morning-briefing/secrets/worker.env)" = 600
test "$(stat -c '%a' /srv/apps)" = 700
LINUX_TEST

echo "ok - real Linux permissions allow only the root oneshot boundary and keep secrets at 0600"
