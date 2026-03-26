import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerLogRoutes } from './log-routes.js';

test('GET /api/v1/admin/logs returns stored logs with default filters', async function () {
  const app = Fastify();

  await registerLogRoutes(app, {
    async listLogs() {
      return [
        {
          id: 'log-2',
          timestamp: '2026-03-20T10:05:00.000Z',
          level: 'warn',
          scope: 'backend',
          event: 'slow_request',
          message: 'Request exceeded warning threshold.',
          context: {
            durationMs: 1820
          }
        },
        {
          id: 'log-1',
          timestamp: '2026-03-20T10:00:00.000Z',
          level: 'info',
          scope: 'snapshot-jobs',
          event: 'snapshot_job_processed',
          message: 'snapshot_job_processed for widget-1 on 2026-03-20',
          context: {
            widgetId: 'widget-1',
            snapshotDate: '2026-03-20'
          }
        }
      ];
    },
    async summarizeLogs() {
      return {
        info: 3,
        warn: 1,
        error: 2
      };
    },
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'ralfe@example.com',
          isAdmin: true
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/logs'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      filters: {
        q: '',
        levels: ['info', 'warn', 'error'],
        limit: 200,
        range: 'all'
      },
      totals: {
        stored: {
          info: 3,
          warn: 1,
          error: 2
        },
        filtered: {
          info: 1,
          warn: 1,
          error: 0
        }
      },
      entries: [
        {
          id: 'log-2',
          timestamp: '2026-03-20T10:05:00.000Z',
          level: 'warn',
          scope: 'backend',
          event: 'slow_request',
          message: 'Request exceeded warning threshold.',
          context: {
            durationMs: 1820
          }
        },
        {
          id: 'log-1',
          timestamp: '2026-03-20T10:00:00.000Z',
          level: 'info',
          scope: 'snapshot-jobs',
          event: 'snapshot_job_processed',
          message: 'snapshot_job_processed for widget-1 on 2026-03-20',
          context: {
            widgetId: 'widget-1',
            snapshotDate: '2026-03-20'
          }
        }
      ]
    });
  } finally {
    await app.close();
  }
});

test('GET /api/v1/admin/logs returns newest entries first in the response', async function () {
  const app = Fastify();

  await registerLogRoutes(app, {
    async listLogs() {
      return [
        {
          id: 'log-1',
          timestamp: '2026-03-20T10:00:00.000Z',
          level: 'info',
          scope: 'snapshot-jobs',
          event: 'snapshot_job_processed',
          message: 'snapshot_job_processed for widget-1 on 2026-03-20',
          context: {}
        },
        {
          id: 'log-2',
          timestamp: '2026-03-20T10:05:00.000Z',
          level: 'warn',
          scope: 'backend',
          event: 'slow_request',
          message: 'Request exceeded warning threshold.',
          context: {}
        },
        {
          id: 'log-3',
          timestamp: '2026-03-20T10:10:00.000Z',
          level: 'error',
          scope: 'dashboard-briefing',
          event: 'dashboard_briefing_failed',
          message: 'Dashboard briefing failed.',
          context: {}
        }
      ];
    },
    async summarizeLogs() {
      return {
        info: 1,
        warn: 1,
        error: 1
      };
    },
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'ralfe@example.com',
          isAdmin: true
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/logs'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().entries.map(function mapEntry(entry) {
      return entry.id;
    }), ['log-3', 'log-2', 'log-1']);
  } finally {
    await app.close();
  }
});

test('GET /api/v1/admin/logs normalizes filters', async function () {
  const app = Fastify();
  let receivedFilters = null;
  const originalDateNow = Date.now;

  Date.now = function mockDateNow() {
    return Date.parse('2026-03-20T12:00:00.000Z');
  };

  await registerLogRoutes(app, {
    async listLogs(filters) {
      receivedFilters = filters;
      return [];
    },
    async summarizeLogs() {
      return {
        info: 0,
        warn: 0,
        error: 0
      };
    },
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'ralfe@example.com',
          isAdmin: true
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/logs?q=failed%20job&levels=warn,error,invalid&limit=999&range=2h'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(receivedFilters, {
      search: 'failed job',
      levels: ['warn', 'error'],
      limit: 500,
      since: new Date(Date.now() - (120 * 60 * 1000)).toISOString()
    });
    assert.deepEqual(response.json().filters, {
      q: 'failed job',
      levels: ['warn', 'error'],
      limit: 500,
      range: '2h'
    });
  } finally {
    Date.now = originalDateNow;
    await app.close();
  }
});
