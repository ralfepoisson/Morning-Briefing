#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SERVERLESS_DIR="${ROOT_DIR}/cicd/serverless"
STAGE="${STAGE:-dev}"
REGION="${AWS_REGION:-eu-west-3}"
DB_NAME="${DB_NAME:-morning_briefing}"
DB_USER="${DB_USER:-morning_briefing}"
DB_PASSWORD="${DB_PASSWORD:-change-me-now}"
HOSTED_ZONE_NAME="${HOSTED_ZONE_NAME:-ralfepoisson.com}"
FRONTEND_DOMAIN_NAME="${FRONTEND_DOMAIN_NAME:-briefing.ralfepoisson.com}"
GOOGLE_OAUTH_CLIENT_ID="${GOOGLE_OAUTH_CLIENT_ID:-}"
GOOGLE_OAUTH_CLIENT_SECRET="${GOOGLE_OAUTH_CLIENT_SECRET:-}"
GOOGLE_OAUTH_REDIRECT_URI="${GOOGLE_OAUTH_REDIRECT_URI:-}"
GOOGLE_OAUTH_STATE_SECRET="${GOOGLE_OAUTH_STATE_SECRET:-}"
NIGHTLY_REFRESH_SCHEDULE="${NIGHTLY_REFRESH_SCHEDULE:-cron(0 4 * * ? *)}"
FRONTEND_DESIRED_COUNT="${FRONTEND_DESIRED_COUNT:-1}"
BACKEND_DESIRED_COUNT="${BACKEND_DESIRED_COUNT:-1}"
WORKER_DESIRED_COUNT="${WORKER_DESIRED_COUNT:-1}"
IMPORT_REFERENCE_CITIES="${IMPORT_REFERENCE_CITIES:-false}"
STACK_NAME="morning-briefing-platform-${STAGE}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
PLACEHOLDER_BACKEND_IMAGE="public.ecr.aws/docker/library/node:20-bookworm-slim"
PLACEHOLDER_FRONTEND_IMAGE="public.ecr.aws/nginx/nginx:stable-alpine"

require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command not found: ${command_name}" >&2
    exit 1
  fi
}

verify_aws_credentials() {
  if ! aws sts get-caller-identity --region "${REGION}" >/dev/null 2>&1; then
    cat >&2 <<EOF
AWS credentials are not available for this shell.

Make sure one of these is true before running the deploy:
  1. You exported AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and optionally AWS_SESSION_TOKEN
  2. You set AWS_PROFILE to a configured profile name
  3. Your source script exports working AWS credentials into the current shell

Quick checks:
  aws sts get-caller-identity --region ${REGION}
  echo \$AWS_PROFILE

EOF
    exit 1
  fi
}

lookup_hosted_zone_id() {
  aws route53 list-hosted-zones-by-name \
    --dns-name "${HOSTED_ZONE_NAME}" \
    --query "HostedZones[?Name=='${HOSTED_ZONE_NAME}.'] | [0].Id" \
    --output text | sed 's|/hostedzone/||'
}

deploy_stack() {
  local backend_image="$1"
  local frontend_image="$2"
  local frontend_count="$3"
  local backend_count="$4"
  local worker_count="$5"
  local -a serverless_args

  serverless_args=(
    deploy
    --stage "${STAGE}"
    --region "${REGION}"
    --param="frontendImage=${frontend_image}"
    --param="backendImage=${backend_image}"
    --param="hostedZoneName=${HOSTED_ZONE_NAME}"
    --param="hostedZoneId=${HOSTED_ZONE_ID}"
    --param="frontendDomainName=${FRONTEND_DOMAIN_NAME}"
    --param="frontendDesiredCount=${frontend_count}"
    --param="backendDesiredCount=${backend_count}"
    --param="workerDesiredCount=${worker_count}"
    --param="dbName=${DB_NAME}"
    --param="dbUser=${DB_USER}"
    --param="dbPassword=${DB_PASSWORD}"
    --param="nightlyRefreshSchedule=${NIGHTLY_REFRESH_SCHEDULE}"
  )

  if [[ -n "${GOOGLE_OAUTH_CLIENT_ID}" ]]; then
    serverless_args+=(--param="googleOauthClientId=${GOOGLE_OAUTH_CLIENT_ID}")
  fi

  if [[ -n "${GOOGLE_OAUTH_CLIENT_SECRET}" ]]; then
    serverless_args+=(--param="googleOauthClientSecret=${GOOGLE_OAUTH_CLIENT_SECRET}")
  fi

  if [[ -n "${GOOGLE_OAUTH_REDIRECT_URI}" ]]; then
    serverless_args+=(--param="googleOauthRedirectUri=${GOOGLE_OAUTH_REDIRECT_URI}")
  fi

  if [[ -n "${GOOGLE_OAUTH_STATE_SECRET}" ]]; then
    serverless_args+=(--param="googleOauthStateSecret=${GOOGLE_OAUTH_STATE_SECRET}")
  fi

  (
    cd "${SERVERLESS_DIR}"
    npm ci
    npx serverless "${serverless_args[@]}"
  )
}

stack_output() {
  local output_key="$1"
  aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue" \
    --output text
}

require_command aws
require_command docker
require_command npm
verify_aws_credentials
HOSTED_ZONE_ID="$(lookup_hosted_zone_id)"

if [[ -z "${HOSTED_ZONE_ID}" || "${HOSTED_ZONE_ID}" == "None" ]]; then
  echo "Unable to find a Route53 hosted zone for ${HOSTED_ZONE_NAME}" >&2
  exit 1
fi

deploy_stack "${PLACEHOLDER_BACKEND_IMAGE}" "${PLACEHOLDER_FRONTEND_IMAGE}" 0 0 0

BACKEND_REPO_URI="$(stack_output BackendEcrRepositoryUri)"
FRONTEND_REPO_URI="$(stack_output FrontendEcrRepositoryUri)"
BACKEND_IMAGE="${BACKEND_REPO_URI}:${IMAGE_TAG}"
FRONTEND_IMAGE="${FRONTEND_REPO_URI}:${IMAGE_TAG}"

aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "$(echo "${BACKEND_REPO_URI}" | cut -d/ -f1)"

BACKEND_IMAGE_TAG="${BACKEND_IMAGE}" FRONTEND_IMAGE_TAG="${FRONTEND_IMAGE}" "${ROOT_DIR}/cicd/ci/docker-build.sh"
"${ROOT_DIR}/cicd/ci/docker-push.sh" "${BACKEND_IMAGE}" "${FRONTEND_IMAGE}"

deploy_stack "${BACKEND_IMAGE}" "${FRONTEND_IMAGE}" 0 0 0
"${SERVERLESS_DIR}/scripts/run-migrations.sh"

deploy_stack "${BACKEND_IMAGE}" "${FRONTEND_IMAGE}" "${FRONTEND_DESIRED_COUNT}" "${BACKEND_DESIRED_COUNT}" "${WORKER_DESIRED_COUNT}"

if [[ "${IMPORT_REFERENCE_CITIES}" == "true" ]]; then
  "${SERVERLESS_DIR}/scripts/run-reference-city-import.sh"
fi

echo "Application URL: $(stack_output ApplicationUrl)"
