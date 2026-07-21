const playwright = require('@playwright/test');

const backendPort = Number(process.env.MORNING_BRIEFING_E2E_BACKEND_PORT || 39123);
const apiBaseUrl = `http://127.0.0.1:${backendPort}/api/v1`;

const test = playwright.test.extend({
  page: async function ({ page }, use) {
    await page.addInitScript(function (configuredApiBaseUrl) {
      window.__MORNING_BRIEFING_CONFIG__ = Object.assign(
        {},
        window.__MORNING_BRIEFING_CONFIG__ || {},
        { apiBaseUrl: configuredApiBaseUrl }
      );
    }, apiBaseUrl);

    await use(page);
  }
});

module.exports = {
  test,
  expect: playwright.expect
};
