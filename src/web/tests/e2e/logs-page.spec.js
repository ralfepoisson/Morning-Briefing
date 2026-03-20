const { test, expect } = require('@playwright/test');

const dashboards = [
  {
    id: 'dashboard-1',
    name: "Ralfe's Morning Briefing",
    description: 'Primary dashboard',
    theme: 'aurora'
  }
];

const logEntries = [
  {
    id: 'log-1',
    timestamp: '2026-03-20T19:20:00.000Z',
    level: 'info',
    scope: 'backend',
    event: 'backend_started',
    message: 'Backend listening on http://127.0.0.1:3000',
    context: {
      host: '127.0.0.1',
      port: 3000
    }
  },
  {
    id: 'log-2',
    timestamp: '2026-03-20T19:10:00.000Z',
    level: 'warn',
    scope: 'snapshot-service',
    event: 'widget_snapshot_failed',
    message: 'Weather provider request failed before receiving a response from https://api.open-meteo.com: ECONNREFUSED connect ECONNREFUSED 127.0.0.1:443.',
    context: {
      widgetId: 'weather-1',
      widgetType: 'weather',
      source: 'dashboard_refresh'
    }
  },
  {
    id: 'log-3',
    timestamp: '2026-03-20T18:10:00.000Z',
    level: 'error',
    scope: 'snapshot-service',
    event: 'widget_snapshot_failed',
    message: 'Google Calendar request failed with status 403.',
    context: {
      widgetId: 'calendar-1',
      widgetType: 'calendar',
      connectionName: 'Google Calendar'
    }
  }
];

test.describe('Admin logs page', function () {
  test.beforeEach(async function ({ page }) {
    await page.route('http://127.0.0.1:3000/api/v1/dashboards', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: dashboards
        })
      });
    });

    await page.route('http://127.0.0.1:3000/api/v1/admin/logs**', async function (route) {
      const url = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildLogResponse(url.searchParams))
      });
    });

    await page.goto('/#/admin/logs');
  });

  test('loads logs, expands context, and supports time range changes', async function ({ page }) {
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
    await expect(page.getByText(/Matching logs/i)).toBeVisible();

    await expect(page.getByText('Backend listening on http://127.0.0.1:3000')).toBeVisible();
    await expect(page.getByText('Google Calendar request failed with status 403.')).toHaveCount(0);

    await page.getByLabel('Time range').selectOption({ label: 'All available logs' });

    await expect(page.getByText('Google Calendar request failed with status 403.')).toBeVisible();

    const showContextButtons = page.getByRole('button', { name: 'Show context' });
    await showContextButtons.nth(0).click();

    await expect(page.getByText('"host": "127.0.0.1"')).toBeVisible();
  });

  test('filters by log level', async function ({ page }) {
    await page.getByLabel('Time range').selectOption({ label: 'All available logs' });
    await page.getByRole('button', { name: /Info/ }).click();

    await expect(page.getByText('Backend listening on http://127.0.0.1:3000')).toHaveCount(0);
    await expect(page.getByText('Google Calendar request failed with status 403.')).toBeVisible();
  });
});

function buildLogResponse(searchParams) {
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const levels = (searchParams.get('levels') || 'info,warn,error')
    .split(',')
    .map(function mapLevel(level) {
      return level.trim().toLowerCase();
    })
    .filter(Boolean);
  const range = searchParams.get('range') || 'all';
  const limit = Math.max(1, Math.min(Number(searchParams.get('limit') || 200), 500));
  const since = getSinceTimestamp(range);
  const visibleLevels = new Set(levels.length ? levels : ['info', 'warn', 'error']);

  const filtered = logEntries
    .filter(function filterEntry(entry) {
      if (!visibleLevels.has(entry.level)) {
        return false;
      }

      if (since && Date.parse(entry.timestamp) < since) {
        return false;
      }

      if (!q) {
        return true;
      }

      return [
        entry.timestamp,
        entry.level,
        entry.scope,
        entry.event,
        entry.message,
        JSON.stringify(entry.context)
      ].join(' ').toLowerCase().includes(q);
    })
    .slice(0, limit);

  return {
    filters: {
      q,
      levels: Array.from(visibleLevels),
      limit,
      range
    },
    totals: {
      stored: summarize(logEntries),
      filtered: summarize(filtered)
    },
    entries: filtered
  };
}

function getSinceTimestamp(range) {
  const now = Date.parse('2026-03-20T19:30:00.000Z');

  if (range === '30m') {
    return now - (30 * 60 * 1000);
  }

  if (range === '2h') {
    return now - (2 * 60 * 60 * 1000);
  }

  if (range === '1d') {
    return now - (24 * 60 * 60 * 1000);
  }

  if (range === '1w') {
    return now - (7 * 24 * 60 * 60 * 1000);
  }

  return null;
}

function summarize(entries) {
  return entries.reduce(function reduceSummary(summary, entry) {
    summary[entry.level] += 1;
    return summary;
  }, {
    info: 0,
    warn: 0,
    error: 0
  });
}
