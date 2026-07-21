#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container_id=''
cleanup() {
  if [[ -n "${container_id}" ]]; then
    docker rm -f "${container_id}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

container_id="$(docker create -i --platform linux/arm64 \
  --entrypoint bash \
  node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d \
  -se)"
docker cp "${ROOT_DIR}/scripts/lib/release-common.sh" "${container_id}:/release-common.sh"

docker start -ai "${container_id}" <<'CONTAINER_TEST'
set -euo pipefail
source /release-common.sh

mkdir -p /secrets
printf '%s\n' 'KEY=value' > /secrets/valid.env
chown root:root /secrets/valid.env
chmod 0600 /secrets/valid.env
assert_secret_file_mode /secrets/valid.env

prepare_runtime_directory /srv/apps/morning-briefing/data/rabbitmq 100 101
[[ "$(stat -c '%a:%u:%g' /srv/apps/morning-briefing/data/rabbitmq)" == '750:100:101' ]]

cp /secrets/valid.env /secrets/group-readable.env
chmod 0640 /secrets/group-readable.env
if assert_secret_file_mode /secrets/group-readable.env >/dev/null 2>&1; then
  echo 'group-readable secret was accepted' >&2
  exit 1
fi

cp /secrets/valid.env /secrets/non-root.env
chown 1000:1000 /secrets/non-root.env
chmod 0600 /secrets/non-root.env
if assert_secret_file_mode /secrets/non-root.env >/dev/null 2>&1; then
  echo 'non-root-owned secret was accepted' >&2
  exit 1
fi

cp /secrets/valid.env /secrets/non-root-group.env
chown 0:1000 /secrets/non-root-group.env
chmod 0600 /secrets/non-root-group.env
if assert_secret_file_mode /secrets/non-root-group.env >/dev/null 2>&1; then
  echo 'non-root-group secret was accepted' >&2
  exit 1
fi

ln -s /secrets/valid.env /secrets/symlink.env
if assert_secret_file_mode /secrets/symlink.env >/dev/null 2>&1; then
  echo 'secret symlink was accepted' >&2
  exit 1
fi
CONTAINER_TEST

echo 'ok - Linux enforces root-only secrets and the RabbitMQ 0750 UID/GID runtime directory'
