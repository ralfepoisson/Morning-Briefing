#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_DIR="${ROOT_DIR}/src/web"
DIST_DIR="${WEB_DIR}/dist"

cd "${WEB_DIR}"
if [[ "${FRONTEND_SKIP_NPM_CI:-false}" != "true" ]]; then
  npm ci
fi
npm run build
