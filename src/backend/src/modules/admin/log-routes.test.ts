import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerLogRoutes } from './log-routes.js';

test('GET /api/v1/admin/logs returns stored logs with default filters', async function () {
  const app = Fastify();

  await registerLogRoutes(app, {
    listLogs: function listLogs() {
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
    summarizeLogs: function summarizeLogs() {
      return {
        info: 3,
        warn: 1,
        error: 2
      };
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
        limit: 200
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

test('GET /api/v1/admin/logs normalizes filters', async function () {
  const app = Fastify();
  let receivedFilters = null;

  await registerLogRoutes(app, {
    listLogs: function listLogs(filters) {
      receivedFilters = filters;
      return [];
    },
    summarizeLogs: function summarizeLogs() {
      return {
        info: 0,
        warn: 0,
        error: 0
      };
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/logs?q=failed%20job&levels=warn,error,invalid&limit=999'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(receivedFilters, {
      search: 'failed job',
      levels: ['warn', 'error'],
      limit: 500
    });
    assert.deepEqual(response.json().filters, {
      q: 'failed job',
      levels: ['warn', 'error'],
      limit: 500
    });
  } finally {
    await app.close();
  }
});
