const { test, expect } = require('@playwright/test');

const TOKEN_KEY = 'morningBriefing.auth.token';
const SESSION_KEY = 'morningBriefing.auth.session';

const dashboard = {
  id: 'dashboard-1',
  name: "Ralfe's Morning Briefing",
  description: 'Primary dashboard',
  theme: 'aurora'
};

const widget = {
  id: 'widget-tasks-1',
  dashboardId: dashboard.id,
  type: 'tasks',
  title: 'Task List',
  x: 0,
  y: 0,
  width: 360,
  height: 360,
  minWidth: 360,
  minHeight: 260,
  config: {},
  data: {
    provider: 'todoist',
    connectionLabel: 'Not connected',
    emptyMessage: 'Choose a connection in edit mode to configure this widget.',
    groups: []
  }
};

test.describe('Create Todoist connection from the task widget', function () {
  test('saves the connection without triggering a browser CORS failure', async function ({ page }) {
    const token = createToken({
      userid: 'ralfepoisson@gmail.com',
      accountId: 'playwright-connection-cors',
      email: 'ralfepoisson@gmail.com',
      exp: futureExp()
    });
    const browserErrors = [];

    page.on('console', function handleConsole(message) {
      if (message.type() === 'error') {
        browserErrors.push(message.text());
      }
    });

    await page.addInitScript(([tokenKey, sessionKey, authToken]) => {
      window.localStorage.setItem(tokenKey, authToken);
      window.localStorage.setItem(sessionKey, JSON.stringify({
        userid: 'ralfepoisson@gmail.com',
        accountId: 'playwright-connection-cors',
        displayName: 'Ralfe',
        email: 'ralfepoisson@gmail.com'
      }));
    }, [TOKEN_KEY, SESSION_KEY, token]);

    await page.route('http://127.0.0.1:3000/api/v1/dashboards', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [dashboard]
        })
      });
    });

    await page.route('http://127.0.0.1:3000/api/v1/dashboards/' + dashboard.id + '/widgets', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [widget]
        })
      });
    });

    await page.route('http://127.0.0.1:3000/api/v1/dashboards/' + dashboard.id + '/snapshots/latest', async function (route) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Snapshot not found.'
        })
      });
    });

    await page.goto('/#/');

    await expect(page.getByRole('heading', { name: dashboard.name })).toBeVisible();

    await page.getByRole('button', { name: 'Edit Dashboard' }).click();
    await page.getByRole('button', { name: 'Configure widget' }).click();
    await expect(page.getByRole('heading', { name: 'Configure Task List' })).toBeVisible();

    await page.getByRole('button', { name: 'Create new connection' }).click();
    await expect(page.getByRole('heading', { name: 'New connection' })).toBeVisible();

    const createResponsePromise = page.waitForResponse(function (response) {
      return response.url().endsWith('/api/v1/connections') && response.request().method() === 'POST';
    });

    await page.getByLabel('Todoist API Key').fill('playwright-test-key');
    await page.locator('.connection-modal').getByRole('button', { name: 'Save' }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    await expect(page.getByText('Selected connection:')).toContainText('Todoist');

    expect(browserErrors.filter(function (message) {
      return /CORS|blocked by CORS policy|ERR_FAILED/i.test(message);
    })).toEqual([]);
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
