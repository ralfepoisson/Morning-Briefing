#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/release-common.sh
source "${ROOT_DIR}/scripts/lib/release-common.sh"

require_repository_identity "${ROOT_DIR}"
require_clean_worktree "${ROOT_DIR}"
require_release_commit "${ROOT_DIR}"

export AWS_EC2_METADATA_DISABLED=true
export AWS_PAGER=''
export NODE_OPTIONS="${NODE_OPTIONS:---throw-deprecation --trace-warnings}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/morning_briefing?schema=public}"

npm --prefix "${ROOT_DIR}/src/backend" ci
(cd "${ROOT_DIR}/src/backend" && npx prisma generate)
npm --prefix "${ROOT_DIR}/src/backend" run typecheck:full
npm --prefix "${ROOT_DIR}/src/backend" run build
npm --prefix "${ROOT_DIR}/src/backend" test
npm --prefix "${ROOT_DIR}/src/backend" audit --omit=dev
npm --prefix "${ROOT_DIR}/src/backend" audit
(cd "${ROOT_DIR}/src/backend" && npx prisma validate)

npm --prefix "${ROOT_DIR}/src/web" ci
npm --prefix "${ROOT_DIR}/src/web" test
npm --prefix "${ROOT_DIR}/src/web" run build
npm --prefix "${ROOT_DIR}/src/web" run test:container-config
npm --prefix "${ROOT_DIR}/src/web" audit --omit=dev
npm --prefix "${ROOT_DIR}/src/web" audit
npm --prefix "${ROOT_DIR}/src/web" run test:e2e

sha="$(git -C "${ROOT_DIR}" rev-parse HEAD)"
backend_image="morning-briefing-backend:ci-${sha}"
frontend_image="morning-briefing-frontend:ci-${sha}"
BACKEND_IMAGE_TAG="${backend_image}" FRONTEND_IMAGE_TAG="${frontend_image}" \
  "${ROOT_DIR}/cicd/ci/docker-build.sh"

BACKEND_INTEGRATION_IMAGE="${backend_image}" "${ROOT_DIR}/scripts/integration-test.sh"

docker run --rm --platform linux/arm64 --entrypoint node "${backend_image}" --version | grep -E '^v24\.'
docker run --rm --platform linux/arm64 --entrypoint nginx "${frontend_image}" -t

plantuml -checkonly "${ROOT_DIR}/docs/diagrams/backend-package-diagram.puml" "${ROOT_DIR}/docs/diagrams/data-model.puml"
require_clean_worktree "${ROOT_DIR}"
echo "Morning Briefing CI passed for ${sha}."
