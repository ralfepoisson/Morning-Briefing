#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_DIR="${ROOT_DIR}/src/web"
DIST_DIR="${WEB_DIR}/dist"

cd "${WEB_DIR}"
npm ci
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

cp -R app "${DIST_DIR}/app"
cp -R assets "${DIST_DIR}/assets"
cp -R node_modules "${DIST_DIR}/node_modules"
cp favicon.ico "${DIST_DIR}/favicon.ico"
cp index.html "${DIST_DIR}/index.html"

cat > "${DIST_DIR}/config.js" <<EOF
window.__MORNING_BRIEFING_CONFIG__ = Object.assign({
  apiBaseUrl: '${FRONTEND_API_BASE_URL:-/api/v1}',
  authServiceSignInUrl: '${FRONTEND_AUTH_SERVICE_SIGN_IN_URL:-https://auth.life-sqrd.com/signIn}',
  authServiceApplicationId: '${FRONTEND_AUTH_SERVICE_APPLICATION_ID:-39863fc2-c2b9-4b5f-82ee-04841b2e9980}',
  authServiceSignOutUrl: '${FRONTEND_AUTH_SERVICE_SIGN_OUT_URL:-}',
  appBaseUrl: '${FRONTEND_APP_BASE_URL:-}'
}, window.__MORNING_BRIEFING_CONFIG__ || {});
EOF
