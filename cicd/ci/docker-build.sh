#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

BACKEND_IMAGE_TAG="${BACKEND_IMAGE_TAG:-morning-briefing-backend:local}"
FRONTEND_IMAGE_TAG="${FRONTEND_IMAGE_TAG:-morning-briefing-frontend:local}"

"${ROOT_DIR}/cicd/ci/build-backend.sh"
"${ROOT_DIR}/cicd/ci/build-frontend.sh"

docker build \
  -f "${ROOT_DIR}/cicd/ci/Dockerfile.backend" \
  -t "${BACKEND_IMAGE_TAG}" \
  "${ROOT_DIR}"

docker build \
  -f "${ROOT_DIR}/cicd/ci/Dockerfile.frontend" \
  -t "${FRONTEND_IMAGE_TAG}" \
  "${ROOT_DIR}"
