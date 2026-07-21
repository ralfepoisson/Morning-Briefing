import { writeFileSync } from 'node:fs';

const outputPath = process.argv[2];

if (!outputPath) {
  throw new Error('Usage: node render-frontend-config.mjs <output-path>');
}

const config = {
  apiBaseUrl: process.env.FRONTEND_API_BASE_URL || '/api/v1',
  authServiceSignInUrl: process.env.FRONTEND_AUTH_SERVICE_SIGN_IN_URL || 'https://auth.life-sqrd.com/signIn',
  authServiceApplicationId: process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID || '39863fc2-c2b9-4b5f-82ee-04841b2e9980',
  authServiceSignOutUrl: process.env.FRONTEND_AUTH_SERVICE_SIGN_OUT_URL || '',
  appBaseUrl: process.env.FRONTEND_APP_BASE_URL || ''
};
const serializedConfig = JSON.stringify(config, null, 2)
  .replaceAll('<', '\\u003c')
  .replaceAll('\u2028', '\\u2028')
  .replaceAll('\u2029', '\\u2029');
const contents = `window.__MORNING_BRIEFING_CONFIG__ = Object.assign(${serializedConfig}, window.__MORNING_BRIEFING_CONFIG__ || {});\n`;

writeFileSync(outputPath, contents, {
  encoding: 'utf8',
  mode: 0o644
});
