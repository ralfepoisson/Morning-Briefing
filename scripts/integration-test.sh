#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_image="${BACKEND_INTEGRATION_IMAGE:?BACKEND_INTEGRATION_IMAGE is required}"
suffix="$(git -C "${ROOT_DIR}" rev-parse --short=12 HEAD)-$$"
network="morning-briefing-ci-${suffix}"
postgres_container="morning-briefing-ci-postgres-${suffix}"
rabbitmq_container="morning-briefing-ci-rabbitmq-${suffix}"
rabbitmq_data_name="morning-briefing-rabbitmq-${suffix}"
rabbitmq_data_dir="/tmp/${rabbitmq_data_name}"
postgres_image="postgres:18-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296"
rabbitmq_image="rabbitmq:4.1-alpine@sha256:d2baf254132a017d54f1bf546dbf827190f4063644065307d8fe7f9532106919"
database_url="postgresql://postgres:integration-only@${postgres_container}:5432/morning_briefing?schema=public"
broken_database_url="postgresql://postgres:integration-only@${postgres_container}:1/morning_briefing?schema=public&connect_timeout=1"
broker_url="amqp://integration:integration-only@${rabbitmq_container}:5672"

cleanup() {
  docker rm -f "${rabbitmq_container}" >/dev/null 2>&1 || true
  docker rm -f "${postgres_container}" >/dev/null 2>&1 || true
  docker network rm "${network}" >/dev/null 2>&1 || true
  docker run --rm --platform linux/arm64 --user 0:0 \
    --mount 'type=bind,source=/tmp,target=/integration-host-tmp' \
    -e INTEGRATION_DATA_NAME="${rabbitmq_data_name}" \
    --entrypoint sh "${rabbitmq_image}" \
    -c 'case "$INTEGRATION_DATA_NAME" in morning-briefing-rabbitmq-*) rm -rf -- "/integration-host-tmp/$INTEGRATION_DATA_NAME" ;; *) exit 1 ;; esac' \
    >/dev/null 2>&1 || true
}
trap cleanup EXIT

start_rabbitmq() {
  docker run -d --platform linux/arm64 --user 100:101 --name "${rabbitmq_container}" \
    --hostname morning-briefing-rabbitmq-integration --network "${network}" \
    --mount "type=bind,source=${rabbitmq_data_dir},target=/var/lib/rabbitmq" \
    -e RABBITMQ_NODENAME=rabbit@morning-briefing-rabbitmq-integration \
    -e RABBITMQ_DEFAULT_USER=integration \
    -e RABBITMQ_DEFAULT_PASS=integration-only \
    "${rabbitmq_image}" >/dev/null

  for _ in $(seq 1 60); do
    if docker exec "${rabbitmq_container}" rabbitmq-diagnostics -q check_running >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done

  docker logs "${rabbitmq_container}" >&2
  echo 'RabbitMQ did not become ready.' >&2
  return 1
}

run_broker_integration() {
  local integration_database_url="$1"
  shift
  docker run --rm --platform linux/arm64 --network "${network}" \
    -e DATABASE_URL="${integration_database_url}" \
    -e MESSAGE_BROKER_ENABLED=true \
    -e MESSAGE_BROKER_URL="${broker_url}" \
    -e MESSAGE_BROKER_EXCHANGE=morning-briefing.integration.jobs \
    -e MESSAGE_BROKER_QUEUE=morning-briefing.integration.jobs \
    -e MESSAGE_BROKER_RETRY_QUEUE=morning-briefing.integration.jobs.retry \
    -e MESSAGE_BROKER_DLQ=morning-briefing.integration.jobs.dlq \
    -e MESSAGE_BROKER_RETRY_DELAY_MS=500 \
    -e MESSAGE_BROKER_MAX_ATTEMPTS=3 \
    -e MESSAGE_BROKER_PREFETCH=1 \
    -e SNAPSHOT_JOB_LEASE_SECONDS=5 \
    "${backend_image}" \
    node dist/scripts/run-message-broker-integration.js "$@"
}

docker network create "${network}" >/dev/null
docker run --rm --platform linux/arm64 --user 0:0 \
  --volume "${rabbitmq_data_dir}:/integration-rabbitmq" \
  --entrypoint sh "${rabbitmq_image}" \
  -c 'test -z "$(find /integration-rabbitmq -mindepth 1 -maxdepth 1 -print -quit)" && chown 100:101 /integration-rabbitmq && chmod 0700 /integration-rabbitmq'
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
start_rabbitmq
rabbitmq_data_contract="$(docker exec "${rabbitmq_container}" stat -c '%u:%g:%a' /var/lib/rabbitmq)"
[[ "${rabbitmq_data_contract}" == '100:101:700' ]]
docker exec --user 100:101 "${rabbitmq_container}" test -w /var/lib/rabbitmq
echo 'RabbitMQ bind storage is private and writable only through UID 100/GID 101.'

run_broker_integration "${database_url}" fresh-readiness
fresh_exchange_contract="$(docker exec "${rabbitmq_container}" rabbitmqctl -q list_exchanges name type durable)"
grep -Eq '^morning-briefing\.integration\.jobs[[:space:]]+direct[[:space:]]+true$' <<<"${fresh_exchange_contract}"
fresh_queue_contract="$(docker exec "${rabbitmq_container}" rabbitmqctl -q list_queues name type durable)"
grep -Eq '^morning-briefing\.integration\.jobs[[:space:]]+quorum[[:space:]]+true$' <<<"${fresh_queue_contract}"
grep -Eq '^morning-briefing\.integration\.jobs\.retry[[:space:]]+quorum[[:space:]]+true$' <<<"${fresh_queue_contract}"
grep -Eq '^morning-briefing\.integration\.jobs\.dlq[[:space:]]+quorum[[:space:]]+true$' <<<"${fresh_queue_contract}"
echo 'Fresh persistent data activation created the durable exchange and quorum queues.'

docker run --rm --network "${network}" \
  -e DATABASE_URL="${database_url}" \
  "${backend_image}" \
  npm run db:deploy

table_count="$(docker exec "${postgres_container}" psql -U postgres -d morning_briefing -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
[[ "${table_count}" -ge 19 ]]
echo "PostgreSQL 18 migration integration passed with ${table_count} application tables."

run_broker_integration "${database_url}" prepare-durability
docker stop "${rabbitmq_container}" >/dev/null
docker rm "${rabbitmq_container}" >/dev/null
start_rabbitmq
run_broker_integration "${database_url}" verify-durability

queue_contract="$(docker exec "${rabbitmq_container}" rabbitmqctl -q list_queues name type durable)"
grep -Eq '^morning-briefing\.integration\.jobs[[:space:]]+quorum[[:space:]]+true$' <<<"${queue_contract}"
grep -Eq '^morning-briefing\.integration\.jobs\.dlq[[:space:]]+quorum[[:space:]]+true$' <<<"${queue_contract}"
echo 'RabbitMQ main and dead-letter queues are durable quorum queues.'

run_broker_integration "${database_url}" duplicate
run_broker_integration "${database_url}" redelivery

run_broker_integration "${database_url}" publish retry-recovery
run_broker_integration "${broken_database_url}" handle-one
run_broker_integration "${database_url}" recover retry-recovery

run_broker_integration "${database_url}" publish retry-exhaustion
for _ in $(seq 1 3); do
  run_broker_integration "${broken_database_url}" handle-one
done
run_broker_integration "${database_url}" assert-dlq retry-exhaustion

run_broker_integration "${database_url}" malformed
run_broker_integration "${database_url}" readiness
echo 'RabbitMQ and PostgreSQL message-broker integration passed.'
