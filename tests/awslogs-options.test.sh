#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${ROOT_DIR}/cicd/compose/compose.yaml"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/morning-briefing-awslogs.XXXXXX")"
container_ids=()
cleanup() {
  local container_id
  set +u
  for container_id in "${container_ids[@]}"; do
    docker rm -f "${container_id}" >/dev/null 2>&1 || true
  done
  set -u
  rm -rf "${test_root}"
}
trap cleanup EXIT

fail() {
  echo "not ok - $1" >&2
  exit 1
}

if grep -Fq 'awslogs-stream-prefix:' "${compose_file}"; then
  fail "Compose uses the unsupported ECS awslogs-stream-prefix option"
fi

expected_streams=(
  morning-briefing-backend
  morning-briefing-rabbitmq
  morning-briefing-frontend
  morning-briefing-worker
  morning-briefing-migrate
  morning-briefing-snapshot-refresh
  morning-briefing-dashboard-audio-refresh
)
for stream in "${expected_streams[@]}"; do
  grep -Fq "awslogs-stream: ${stream}" "${compose_file}" \
    || fail "Compose omits deterministic awslogs stream ${stream}"
done
[[ "$(grep -c 'awslogs-stream:' "${compose_file}")" -eq "${#expected_streams[@]}" ]] \
  || fail "Compose awslogs stream names are not one-to-one with services"

image='node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d'
mkdir -p "${test_root}/secrets" "${test_root}/shared/config" "${test_root}/data/audio" "${test_root}/data/rabbitmq"
touch \
  "${test_root}/secrets/backend.env" \
  "${test_root}/secrets/worker.env" \
  "${test_root}/secrets/rabbitmq.env" \
  "${test_root}/shared/config/backend.env" \
  "${test_root}/shared/config/worker.env"
APP_ROOT="${test_root}" \
BACKEND_IMAGE="${image}" \
FRONTEND_IMAGE="${image}" \
BACKEND_AWSLOGS_GROUP=/personal-projects/morning-briefing \
FRONTEND_AWSLOGS_GROUP=/personal-projects/morning-briefing \
WORKER_AWSLOGS_GROUP=/personal-projects/morning-briefing \
RABBITMQ_AWSLOGS_GROUP=/personal-projects/morning-briefing \
  docker compose -f "${compose_file}" config --quiet
echo 'ok - real Docker Compose accepts the production logging configuration'

if docker create --platform linux/arm64 \
  --log-driver awslogs \
  --log-opt awslogs-region=eu-west-1 \
  --log-opt awslogs-group=/personal-projects/morning-briefing \
  --log-opt awslogs-stream-prefix=invalid \
  "${image}" true >/dev/null 2>&1; then
  fail "Docker accepted unsupported awslogs-stream-prefix"
fi
echo 'ok - Docker rejects unsupported awslogs-stream-prefix'

for stream in "${expected_streams[@]}"; do
  container_id="$(docker create --platform linux/arm64 \
    --log-driver awslogs \
    --log-opt awslogs-region=eu-west-1 \
    --log-opt awslogs-group=/personal-projects/morning-briefing \
    --log-opt awslogs-create-group=false \
    --log-opt "awslogs-stream=${stream}" \
    "${image}" true)"
  container_ids+=("${container_id}")
done
echo 'ok - Docker accepts every deterministic Compose awslogs stream option'
