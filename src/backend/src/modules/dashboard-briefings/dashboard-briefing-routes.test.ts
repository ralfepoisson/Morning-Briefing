import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerDashboardBriefingRoutes } from './dashboard-briefing-routes.js';

test('GET /api/v1/dashboards/:dashboardId/audio-briefing/preferences returns preferences', async function () {
  const app = Fastify();

  await registerDashboardBriefingRoutes(app, {
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
    },
    dashboardBriefingService: {
      async getPreferences(dashboardId) {
        assert.equal(dashboardId, 'dash-1');
        return {
          id: 'pref-1',
          dashboardId: 'dash-1',
          enabled: true,
          autoGenerate: false,
          targetDurationSeconds: 75,
          tone: 'calm, concise, professional',
          language: 'en-GB',
          voiceName: 'default',
          includeWidgetTypes: [],
          createdAt: '2026-03-25T06:00:00.000Z',
          updatedAt: '2026-03-25T06:00:00.000Z'
        };
      },
      async updatePreferences() {
        throw new Error('not used');
      },
      async previewInput() {
        throw new Error('not used');
      },
      async getLatestBriefing() {
        throw new Error('not used');
      },
      async generateBriefing() {
        throw new Error('not used');
      },
      async getAudioMetadata() {
        throw new Error('not used');
      },
      async getAudioContent() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboards/dash-1/audio-briefing/preferences'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().dashboardId, 'dash-1');
  } finally {
    await app.close();
  }
});

test('POST /api/v1/dashboards/:dashboardId/audio-briefing/generate is disabled for dashboard users', async function () {
  const app = Fastify();

  await registerDashboardBriefingRoutes(app, {
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
    },
    dashboardBriefingService: {
      async getPreferences() {
        throw new Error('not used');
      },
      async updatePreferences() {
        throw new Error('not used');
      },
      async previewInput() {
        throw new Error('not used');
      },
      async getLatestBriefing() {
        throw new Error('not used');
      },
      async generateBriefing() {
        throw new Error('not used');
      },
      async getAudioMetadata() {
        throw new Error('not used');
      },
      async getAudioContent() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboards/dash-1/audio-briefing/generate',
      payload: {
        force: true
      }
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), {
      message: 'Manual audio briefing generation is only available from Admin > Dashboards.'
    });
  } finally {
    await app.close();
  }
});
