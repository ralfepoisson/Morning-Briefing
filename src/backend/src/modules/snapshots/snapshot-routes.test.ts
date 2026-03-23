import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerSnapshotRoutes } from './snapshot-routes.js';
import type { DashboardSnapshotResponse } from './snapshot-types.js';

test('GET /api/v1/dashboards/:dashboardId/snapshots/latest returns the latest snapshot', async function () {
  const app = Fastify();
  const expectedSnapshot = createSnapshotResponse();

  await registerSnapshotRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    dashboardService: {
      async listForOwner() {
        throw new Error('not used');
      }
    },
    snapshotService: {
      async getPersistedLatestForDashboard(dashboardId, user) {
        assert.equal(dashboardId, 'dash-1');
        assert.equal(user.userId, 'user-1');
        return expectedSnapshot;
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboards/dash-1/snapshots/latest'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), expectedSnapshot);
  } finally {
    await app.close();
  }
});

test('GET /api/v1/dashboards/:dashboardId/snapshots/latest returns 404 when dashboard is missing', async function () {
  const app = Fastify();

  await registerSnapshotRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    dashboardService: {
      async listForOwner() {
        return [];
      }
    },
    snapshotService: {
      async getPersistedLatestForDashboard() {
        return null;
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboards/dash-missing/snapshots/latest'
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      message: 'Dashboard not found.'
    });
  } finally {
    await app.close();
  }
});

test('GET /api/v1/dashboards/:dashboardId/snapshots/latest returns null when the dashboard exists without a snapshot yet', async function () {
  const app = Fastify();

  await registerSnapshotRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    dashboardService: {
      async listForOwner() {
        return [
          {
            id: 'dash-1',
            name: 'Morning Briefing',
            description: '',
            theme: 'aurora',
            createdAt: '2026-03-23T10:00:00.000Z',
            updatedAt: '2026-03-23T10:00:00.000Z'
          }
        ];
      }
    },
    snapshotService: {
      async getPersistedLatestForDashboard() {
        return null;
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboards/dash-1/snapshots/latest'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'null');
  } finally {
    await app.close();
  }
});

function createSnapshotResponse(overrides: Partial<DashboardSnapshotResponse> = {}): DashboardSnapshotResponse {
  return {
    id: overrides.id || 'snapshot-1',
    dashboardId: overrides.dashboardId || 'dash-1',
    snapshotDate: overrides.snapshotDate || '2026-03-19',
    generationStatus: overrides.generationStatus || 'READY',
    summary: overrides.summary || {
      headline: 'Latest forecast from Open-Meteo for Mulhouse, FR.'
    },
    generatedAt: overrides.generatedAt || '2026-03-19T08:00:00.000Z',
    widgets: overrides.widgets || [
      {
        widgetId: 'widget-1',
        widgetType: 'weather',
        title: 'Weather Outlook',
        status: 'READY',
        content: {
          location: 'Mulhouse, FR',
          temperature: '17°'
        },
        errorMessage: null,
        generatedAt: '2026-03-19T08:00:00.000Z'
      }
    ]
  };
}
