#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/srv/apps/morning-briefing}"
RELEASE_DIR="${1:-${APP_ROOT}/current}"
COMPOSE_FILE="${RELEASE_DIR}/cicd/compose/compose.yaml"
ENV_FILE="${RELEASE_DIR}/release.env"
START_WORKER="${START_WORKER:-false}"

compose() {
  docker compose --project-name morning-briefing --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

wait_healthy() {
  local service="$1" container status
  container="$(compose ps -q "${service}")"
  [[ -n "${container}" ]] || return 1
  for _ in $(seq 1 40); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container}")"
    [[ "${status}" == "healthy" ]] && return 0
    [[ "${status}" == "unhealthy" || "${status}" == "exited" || "${status}" == "dead" ]] && return 1
    sleep 3
  done
  return 1
}

wait_for_http() {
  local url="$1" response
  for _ in $(seq 1 20); do
    if response="$(curl --fail --silent --show-error --max-time 10 "${url}" 2>/dev/null)"; then
      printf '%s' "${response}"
      return 0
    fi
    sleep 2
  done
  return 1
}

wait_healthy rabbitmq
wait_healthy frontend
wait_healthy backend
if [[ "${START_WORKER}" == "true" ]]; then
  wait_healthy worker
fi

backend_ready="$(wait_for_http http://127.0.0.1:13000/health/ready)"
jq -e '.status == "ready"' <<<"${backend_ready}" >/dev/null
wait_for_http http://127.0.0.1:18080/healthz >/dev/null

apache_frontend_type="$(curl --fail --silent --show-error --max-time 10 -H 'Host: briefing.ralfepoisson.com' -o /dev/null -w '%{content_type}' http://127.0.0.1:8080/)"
[[ "${apache_frontend_type}" == text/html* ]]

api_probe="$(mktemp)"
trap 'rm -f "${api_probe}"' EXIT
api_status="$(curl --silent --show-error --max-time 10 -H 'Host: briefing.ralfepoisson.com' -o "${api_probe}" -w '%{http_code}:%{content_type}' http://127.0.0.1:8080/api/v1/dashboards)"
[[ "${api_status}" == 401:application/json* ]]
jq -e '.message | type == "string"' "${api_probe}" >/dev/null

compose exec -T backend node -e "require('node:fs').accessSync('/var/lib/morning-briefing/audio', require('node:fs').constants.R_OK | require('node:fs').constants.W_OK)"
if [[ "${START_WORKER}" == "true" ]]; then
  compose exec -T worker node -e "require('node:fs').accessSync('/var/lib/morning-briefing/audio', require('node:fs').constants.R_OK | require('node:fs').constants.W_OK)"
fi

if [[ "${VERIFY_PUBLIC_PATHS:-false}" == "true" ]]; then
  curl --fail --silent --show-error --max-time 20 https://briefing.ralfepoisson.com/ >/dev/null
  public_api="$(curl --silent --show-error --max-time 20 -o /dev/null -w '%{http_code}:%{content_type}' https://briefing.ralfepoisson.com/api/v1/dashboards)"
  [[ "${public_api}" == 401:application/json* ]]
fi

echo "Morning Briefing release health checks passed."
