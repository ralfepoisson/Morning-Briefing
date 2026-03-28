const { test, expect } = require('@playwright/test');

const TOKEN_KEY = 'morningBriefing.auth.token';
const SESSION_KEY = 'morningBriefing.auth.session';

test.describe('Dashboard widget configuration flows', function () {
  test('persists Include in Audio Briefing selections across a dashboard save', async function ({ page }) {
    const dashboard = createDashboard();
    const widgetsState = [
      createEmailWidget({
        id: 'widget-email-1',
        includeInBriefingDefault: true,
        includeInBriefingOverride: null,
        includeInBriefing: true
      })
    ];
    const patchPayloads = [];

    await signIn(page);
    await mockDashboardApis(page, {
      dashboard,
      widgetsState,
      onPatchWidget: function onPatchWidget(payload, widgetId) {
        patchPayloads.push(payload);
        applyWidgetPatch(widgetsState, widgetId, payload);
      }
    });

    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: dashboard.name })).toBeVisible();

    await page.getByRole('button', { name: 'Edit Dashboard' }).click();
    await page.getByRole('button', { name: 'Configure widget' }).first().click();
    await expect(page.getByRole('heading', { name: 'Configure Email' })).toBeVisible();

    await page.getByRole('checkbox', { name: 'Include in Audio Briefing' }).uncheck();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Save Dashboard' }).click();

    expect(patchPayloads).toHaveLength(1);
    expect(patchPayloads[0].includeInBriefingOverride).toBe(false);

    await page.getByRole('button', { name: 'Edit Dashboard' }).click();
    await page.getByRole('button', { name: 'Configure widget' }).first().click();
    await expect(page.getByRole('checkbox', { name: 'Include in Audio Briefing' })).not.toBeChecked();
  });

  test('adding another widget keeps unsaved layout edits on existing widgets', async function ({ page }) {
    const dashboard = createDashboard();
    const widgetsState = [
      createWeatherWidget({
        id: 'widget-weather-1',
        x: 0,
        y: 0,
        width: 360,
        height: 260
      })
    ];

    await signIn(page);
    await mockDashboardApis(page, {
      dashboard,
      widgetsState
    });

    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: dashboard.name })).toBeVisible();

    await page.getByRole('button', { name: 'Edit Dashboard' }).click();

    await page.evaluate(function mutateWidgetLayout() {
      var injector = window.angular.element(document.body).injector();
      var widgetService = injector.get('WidgetService');
      var $rootScope = injector.get('$rootScope');

      widgetService.updatePosition('dashboard-1', 'widget-weather-1', 140, 180);
      widgetService.updateSize('dashboard-1', 'widget-weather-1', 420, 310);
      $rootScope.$applyAsync();
    });

    await expect(page.locator('.widget-card').first()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 140, 180)');
    await expect(page.locator('.widget-card').first()).toHaveCSS('width', '420px');
    await expect(page.locator('.widget-card').first()).toHaveCSS('height', '310px');

    await page.getByRole('button', { name: '+ Widget' }).click();
    await page.getByRole('button', { name: 'Task list' }).click();

    await expect(page.locator('.widget-card').first()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 140, 180)');
    await expect(page.locator('.widget-card').first()).toHaveCSS('width', '420px');
    await expect(page.locator('.widget-card').first()).toHaveCSS('height', '310px');
    await expect(page.locator('.widget-card')).toHaveCount(2);
  });

  test('widget configuration offers reconnect for OAuth-backed Gmail widgets', async function ({ page }) {
    const dashboard = createDashboard();
    const widgetsState = [
      createEmailWidget({
        id: 'widget-email-1',
        config: {
          connectionId: 'connection-gmail-1',
          connectionName: 'ralfepoisson@gmail.com',
          provider: 'gmail',
          filters: ['label:children-school newer_than:7d']
        },
        data: {
          provider: 'gmail',
          connectionLabel: 'ralfepoisson@gmail.com',
          filters: ['label:children-school newer_than:7d'],
          emptyMessage: 'Email messages are still loading or unavailable. Refresh after the snapshot completes.',
          messages: []
        }
      })
    ];
    let oauthStartPayload = null;

    await signIn(page);
    await mockDashboardApis(page, {
      dashboard,
      widgetsState,
      connections: [
        {
          id: 'connection-gmail-1',
          type: 'gmail',
          name: 'ralfepoisson@gmail.com',
          status: 'ERROR',
          authType: 'OAUTH',
          config: {
            accountEmail: 'ralfepoisson@gmail.com'
          },
          createdAt: '2026-03-28T08:00:00.000Z',
          updatedAt: '2026-03-28T08:10:00.000Z'
        }
      ],
      snapshot: {
        id: 'snapshot-1',
        dashboardId: dashboard.id,
        snapshotDate: '2026-03-28',
        generationStatus: 'FAILED',
        summary: {},
        generatedAt: '2026-03-28T09:45:47.000Z',
        widgets: [
          {
            widgetId: 'widget-email-1',
            widgetType: 'email',
            title: 'Email',
            status: 'FAILED',
            content: widgetsState[0].data,
            errorMessage: 'Google OAuth token refresh failed before receiving a response from https://oauth2.googleapis.com: ETIMEDOUT.',
            generatedAt: '2026-03-28T09:45:47.000Z'
          }
        ]
      },
      onStartGmailOAuth: function onStartGmailOAuth(payload) {
        oauthStartPayload = payload;
      }
    });

    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: dashboard.name })).toBeVisible();

    await page.getByRole('button', { name: 'Edit Dashboard' }).click();
    await page.getByRole('button', { name: 'Configure widget' }).click();
    await expect(page.getByRole('heading', { name: 'Configure Email' })).toBeVisible();
    await expect(page.getByText('Google access for this widget needs to be refreshed.')).toBeVisible();

    const oauthStartRequest = page.waitForRequest('**/api/v1/connections/gmail/oauth/start');
    await page.getByRole('button', { name: 'Reconnect Google' }).click();
    await oauthStartRequest;
    await page.waitForURL('**/oauth-popup');

    expect(oauthStartPayload).toMatchObject({
      connectionId: 'connection-gmail-1'
    });
  });
});

async function signIn(page) {
  const token = createToken({
    userid: 'ralfepoisson@gmail.com',
    accountId: 'playwright-dashboard-config',
    email: 'ralfepoisson@gmail.com',
    exp: futureExp()
  });

  await page.addInitScript(([tokenKey, sessionKey, authToken]) => {
    window.localStorage.setItem(tokenKey, authToken);
    window.localStorage.setItem(sessionKey, JSON.stringify({
      userid: 'ralfepoisson@gmail.com',
      accountId: 'playwright-dashboard-config',
      displayName: 'Ralfe Poisson',
      email: 'ralfepoisson@gmail.com'
    }));
  }, [TOKEN_KEY, SESSION_KEY, token]);
}

async function mockDashboardApis(page, options) {
  const dashboard = options.dashboard;
  const widgetsState = options.widgetsState || [];
  const connections = options.connections || [];
  const snapshot = 'snapshot' in options ? options.snapshot : null;

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
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const nextWidget = body.type === 'tasks'
        ? createTasksWidget({
          id: 'widget-tasks-' + (widgetsState.length + 1),
          x: 64,
          y: 64
        })
        : createWeatherWidget({
          id: 'widget-weather-' + (widgetsState.length + 1),
          x: 64,
          y: 64
        });

      widgetsState.push(nextWidget);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(nextWidget)
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: widgetsState.map(clone)
      })
    });
  });

  await page.route('**/api/v1/dashboards/' + dashboard.id + '/widgets/*', async function (route) {
    const widgetId = route.request().url().split('/').pop();
    const payload = route.request().postDataJSON();

    if (typeof options.onPatchWidget === 'function') {
      options.onPatchWidget(payload, widgetId);
    } else {
      applyWidgetPatch(widgetsState, widgetId, payload);
    }

    const widget = widgetsState.find(function findWidget(item) {
      return item.id === widgetId;
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(widget))
    });
  });

  await page.route('**/api/v1/dashboards/' + dashboard.id + '/snapshots/latest', async function (route) {
    if (!snapshot) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Snapshot not found.'
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot)
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

  await page.route('**/api/v1/connections?type=*', async function (route) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: connections
      })
    });
  });

  await page.route('**/api/v1/connections/gmail/oauth/start', async function (route) {
    if (typeof options.onStartGmailOAuth === 'function') {
      options.onStartGmailOAuth(route.request().postDataJSON());
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authorizationUrl: 'http://127.0.0.1:8080/oauth-popup'
      })
    });
  });
}

function createDashboard() {
  return {
    id: 'dashboard-1',
    name: "Ralfe's Morning Briefing",
    description: 'Primary dashboard',
    theme: 'aurora'
  };
}

function createWeatherWidget(overrides) {
  return Object.assign({
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
    isVisible: true,
    isGenerating: false,
    sortOrder: 1,
    includeInBriefingDefault: true,
    includeInBriefingOverride: null,
    includeInBriefing: true,
    config: {
      location: {
        displayName: 'Mulhouse, FR'
      }
    },
    data: {
      location: 'Mulhouse, FR',
      temperature: '3°C',
      condition: 'Overcast',
      highLow: 'H: 6° L: -1°',
      summary: 'Latest forecast from Open-Meteo for Mulhouse, FR.',
      details: []
    }
  }, overrides || {});
}

function createTasksWidget(overrides) {
  return Object.assign({
    id: 'widget-tasks-1',
    dashboardId: 'dashboard-1',
    type: 'tasks',
    title: 'Task List',
    x: 0,
    y: 0,
    width: 360,
    height: 360,
    minWidth: 360,
    minHeight: 260,
    isVisible: true,
    isGenerating: false,
    sortOrder: 2,
    includeInBriefingDefault: true,
    includeInBriefingOverride: null,
    includeInBriefing: true,
    config: {},
    data: {
      provider: 'todoist',
      connectionLabel: 'Not connected',
      emptyMessage: 'Choose a connection in edit mode to configure this widget.',
      groups: []
    }
  }, overrides || {});
}

function createEmailWidget(overrides) {
  return Object.assign({
    id: 'widget-email-1',
    dashboardId: 'dashboard-1',
    type: 'email',
    title: 'Email',
    x: 0,
    y: 0,
    width: 420,
    height: 360,
    minWidth: 160,
    minHeight: 140,
    isVisible: true,
    isGenerating: false,
    sortOrder: 1,
    includeInBriefingDefault: true,
    includeInBriefingOverride: null,
    includeInBriefing: true,
    config: {
      connectionId: 'connection-gmail-1',
      connectionName: 'ralfepoisson@gmail.com',
      provider: 'gmail',
      filters: ['in:inbox']
    },
    data: {
      provider: 'gmail',
      connectionLabel: 'ralfepoisson@gmail.com',
      filters: ['in:inbox'],
      emptyMessage: 'Email messages are still loading or unavailable. Refresh after the snapshot completes.',
      messages: []
    }
  }, overrides || {});
}

function applyWidgetPatch(widgetsState, widgetId, payload) {
  var widget = widgetsState.find(function findWidget(item) {
    return item.id === widgetId;
  });

  if (!widget) {
    return;
  }

  widget.x = payload.x;
  widget.y = payload.y;
  widget.width = payload.width;
  widget.height = payload.height;
  widget.config = payload.config || widget.config || {};
  widget.includeInBriefingOverride = Object.prototype.hasOwnProperty.call(payload, 'includeInBriefingOverride')
    ? payload.includeInBriefingOverride
    : widget.includeInBriefingOverride;
  widget.includeInBriefing = widget.includeInBriefingOverride === null
    ? widget.includeInBriefingDefault
    : widget.includeInBriefingOverride;
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
