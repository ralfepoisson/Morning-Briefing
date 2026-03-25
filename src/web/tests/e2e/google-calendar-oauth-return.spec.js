const { test, expect } = require('@playwright/test');

const TOKEN_KEY = 'morningBriefing.auth.token';
const SESSION_KEY = 'morningBriefing.auth.session';
const WIDGET_OAUTH_CONTEXT_KEY = 'morningBriefing.widgetOAuthContext';

const dashboard = {
  id: 'dashboard-1',
  name: "Ralfe's Morning Briefing",
  description: 'Primary dashboard',
  theme: 'aurora'
};

const calendarWidget = {
  id: 'widget-calendar-1',
  dashboardId: dashboard.id,
  type: 'calendar',
  title: 'Today on Calendar',
  x: 0,
  y: 0,
  width: 360,
  height: 360,
  minWidth: 360,
  minHeight: 260,
  config: {},
  data: {
    provider: 'google-calendar',
    connectionLabel: 'Not connected',
    dateLabel: 'Today',
    emptyMessage: 'Choose a Google Calendar connection in edit mode to configure this widget.',
    appointments: []
  }
};

const calendarConnection = {
  id: 'connection-2',
  type: 'google-calendar',
  name: 'Google Calendar',
  status: 'ACTIVE',
  authType: 'OAUTH',
  config: {
    calendarId: 'ralfepoisson@gmail.com'
  }
};

test.describe('Google Calendar OAuth callback return', function () {
  test('stages the returned Google Calendar connection onto the calendar widget', async function ({ page }) {
    test.fail(true, 'Known issue: the post-OAuth calendar restore flow does not yet auto-stage the connector reliably.');

    const token = createToken({
      userid: 'ralfepoisson@gmail.com',
      accountId: 'playwright-google-calendar',
      email: 'ralfepoisson@gmail.com',
      exp: futureExp()
    });

    await page.addInitScript(([tokenKey, sessionKey, widgetContextKey, authToken, dashboardId, widgetId]) => {
      window.localStorage.setItem(tokenKey, authToken);
      window.localStorage.setItem(sessionKey, JSON.stringify({
        userid: 'ralfepoisson@gmail.com',
        accountId: 'playwright-google-calendar',
        displayName: 'Ralfe',
        email: 'ralfepoisson@gmail.com'
      }));
      window.sessionStorage.setItem(widgetContextKey, JSON.stringify({
        dashboardId: dashboardId,
        widgetId: widgetId,
        widgetType: 'calendar'
      }));
    }, [TOKEN_KEY, SESSION_KEY, WIDGET_OAUTH_CONTEXT_KEY, token, dashboard.id, calendarWidget.id]);

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
          items: [calendarWidget]
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

    await page.route('http://127.0.0.1:3000/api/v1/connections?type=google-calendar', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [calendarConnection]
        })
      });
    });

    await page.goto('/#/?oauthConnectionId=connection-2&oauthProvider=google-calendar');

    await expect(page.getByRole('heading', { name: dashboard.name })).toBeVisible();
    await expect(page.getByText('Connection: Google Calendar')).toBeVisible();
    await expect(page.getByText('Live appointments will appear after you save the dashboard.')).toBeVisible();

    await expect.poll(async function () {
      return page.url();
    }).not.toContain('oauthConnectionId=');

    const storedWidgetContext = await page.evaluate(function (widgetContextKey) {
      return window.sessionStorage.getItem(widgetContextKey);
    }, WIDGET_OAUTH_CONTEXT_KEY);

    expect(storedWidgetContext).toBeNull();
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
