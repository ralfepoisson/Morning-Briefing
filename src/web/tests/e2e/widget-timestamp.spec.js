const { test, expect } = require('@playwright/test');

const TOKEN_KEY = 'morningBriefing.auth.token';
const SESSION_KEY = 'morningBriefing.auth.session';

const dashboard = {
  id: 'dashboard-1',
  name: 'Timestamp Dashboard',
  description: 'Snapshot timestamp coverage'
};

const widget = {
  id: 'widget-weather-1',
  dashboardId: dashboard.id,
  type: 'weather',
  title: 'Weather Outlook',
  x: 0,
  y: 0,
  width: 360,
  height: 260,
  minWidth: 240,
  minHeight: 220,
  config: {
    location: {
      displayName: 'Paris, France'
    }
  },
  data: {
    location: 'Paris, France',
    temperature: '18°C',
    condition: 'Sunny',
    highLow: 'H 20° / L 12°',
    summary: 'Clear and bright.',
    details: []
  }
};

test.describe('Widget snapshot timestamp', function () {
  test('shows the widget snapshot timestamp in the card footer', async function ({ page }) {
    const token = createToken({
      userid: 'ralfepoisson@gmail.com',
      accountId: 'playwright-widget-timestamp',
      email: 'ralfepoisson@gmail.com',
      exp: futureExp()
    });

    await page.addInitScript(([tokenKey, sessionKey, authToken]) => {
      window.localStorage.setItem(tokenKey, authToken);
      window.localStorage.setItem(sessionKey, JSON.stringify({
        userid: 'ralfepoisson@gmail.com',
        accountId: 'playwright-widget-timestamp',
        displayName: 'Ralfe',
        email: 'ralfepoisson@gmail.com'
      }));
    }, [TOKEN_KEY, SESSION_KEY, token]);

    await page.route(/\/api\/v1\/dashboards$/, async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [dashboard] })
      });
    });

    await page.route('**/api/v1/dashboards/' + dashboard.id + '/widgets', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [widget] })
      });
    });

    await page.route('**/api/v1/dashboards/' + dashboard.id + '/snapshots/latest', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'snapshot-1',
          dashboardId: dashboard.id,
          snapshotDate: '2026-03-28',
          generationStatus: 'READY',
          summary: {},
          generatedAt: '2026-03-28T07:45:00.000Z',
          widgets: [
            {
              widgetId: widget.id,
              widgetType: 'weather',
              title: 'Weather Outlook',
              status: 'READY',
              content: widget.data,
              errorMessage: null,
              generatedAt: '2026-03-28T07:45:00.000Z'
            }
          ]
        })
      });
    });

    await page.route('**/api/v1/dashboards/' + dashboard.id + '/audio-briefing/preferences', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: false,
          targetDurationSeconds: 60,
          tone: 'calm',
          voiceName: 'default'
        })
      });
    });

    await page.route('**/api/v1/dashboards/' + dashboard.id + '/audio-briefing', async function (route) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Audio briefing not found.'
        })
      });
    });

    await page.goto('/#/');

    await expect(page.getByRole('heading', { name: dashboard.name })).toBeVisible();
    await expect(page.locator('.widget-card').first()).toContainText('Snapshot:');
    await expect(page.locator('.widget-card').first()).toContainText('3/28/2026');
  });
});

function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  return `${encodeSegment(header)}.${encodeSegment(payload)}.signature`;
}

function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function futureExp() {
  return Math.floor(Date.now() / 1000) + 3600;
}
