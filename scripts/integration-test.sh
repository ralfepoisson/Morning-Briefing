#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_image="${BACKEND_INTEGRATION_IMAGE:?BACKEND_INTEGRATION_IMAGE is required}"
suffix="$(git -C "${ROOT_DIR}" rev-parse --short=12 HEAD)-$$"
network="morning-briefing-ci-${suffix}"
postgres_container="morning-briefing-ci-postgres-${suffix}"
postgres_image="postgres:18-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296"

cleanup() {
  docker rm -f "${postgres_container}" >/dev/null 2>&1 || true
  docker network rm "${network}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "${network}" >/dev/null
docker run -d --name "${postgres_container}" --network "${network}" \
  -e POSTGRES_PASSWORD=integration-only \
  -e POSTGRES_DB=morning_briefing \
  "${postgres_image}" >/dev/null

for _ in $(seq 1 40); do
  if docker exec "${postgres_container}" pg_isready -U postgres -d morning_briefing >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "${postgres_container}" pg_isready -U postgres -d morning_briefing >/dev/null

docker run --rm --network "${network}" \
  -e DATABASE_URL="postgresql://postgres:integration-only@${postgres_container}:5432/morning_briefing?schema=public" \
  "${backend_image}" \
  npm run db:deploy

table_count="$(docker exec "${postgres_container}" psql -U postgres -d morning_briefing -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
[[ "${table_count}" -ge 19 ]]
echo "PostgreSQL 18 migration integration passed with ${table_count} application tables."
