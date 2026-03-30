const { test, expect } = require('@playwright/test');

const TOKEN_KEY = 'morningBriefing.auth.token';
const SESSION_KEY = 'morningBriefing.auth.session';

test.describe('Dashboard automatic refresh', function () {
  test('reloads the latest snapshot every 15 minutes while viewing the dashboard', async function ({ page }) {
    const dashboard = createDashboard();
    const widgetsState = [createWeatherWidget()];
    let snapshotRequestCount = 0;

    await page.addInitScript(([tokenKey, sessionKey, authToken]) => {
      const originalSetTimeout = window.setTimeout.bind(window);

      window.localStorage.setItem(tokenKey, authToken);
      window.localStorage.setItem(sessionKey, JSON.stringify({
        userid: 'ralfepoisson@gmail.com',
        accountId: 'playwright-dashboard-auto-refresh',
        displayName: 'Ralfe',
        email: 'ralfepoisson@gmail.com'
      }));

      window.setTimeout = function patchedSetTimeout(callback, delay) {
        if (delay === 15 * 60 * 1000) {
          return originalSetTimeout(callback, 10);
        }

        return originalSetTimeout(callback, delay);
      };
    }, [TOKEN_KEY, SESSION_KEY, createToken({
      userid: 'ralfepoisson@gmail.com',
      accountId: 'playwright-dashboard-auto-refresh',
      email: 'ralfepoisson@gmail.com',
      exp: futureExp()
    })]);

    await page.route(/\/api\/v1\/dashboards$/, async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [dashboard]
        })
      });
    });

    await page.route('**/api/v1/dashboards/' + dashboard.id + '/widgets', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: widgetsState.map(clone)
        })
      });
    });

    await page.route('**/api/v1/dashboards/' + dashboard.id + '/snapshots/latest', async function (route) {
      snapshotRequestCount += 1;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(snapshotRequestCount === 1 ? createSnapshot({
          dashboardId: dashboard.id,
          widget: widgetsState[0],
          generatedAt: '2026-03-28T07:45:00.000Z'
        }) : createSnapshot({
          dashboardId: dashboard.id,
          widget: widgetsState[0],
          generatedAt: '2026-03-29T08:15:00.000Z'
        }))
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
    await expect.poll(function () {
      return snapshotRequestCount;
    }).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.widget-card').first()).toContainText('3/29/2026');
  });
});

function createDashboard() {
  return {
    id: 'dashboard-1',
    name: 'Auto Refresh Dashboard',
    description: 'Dashboard auto refresh coverage'
  };
}

function createWeatherWidget() {
  return {
    id: 'widget-weather-1',
    dashboardId: 'dashboard-1',
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
}

function createSnapshot(options) {
  return {
    id: 'snapshot-' + options.generatedAt,
    dashboardId: options.dashboardId,
    snapshotDate: options.generatedAt.slice(0, 10),
    generationStatus: 'READY',
    summary: {},
    generatedAt: options.generatedAt,
    widgets: [
      {
        widgetId: options.widget.id,
        widgetType: options.widget.type,
        title: options.widget.title,
        status: 'READY',
        content: options.widget.data,
        errorMessage: null,
        generatedAt: options.generatedAt
      }
    ]
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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
