import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerAdminDashboardRoutes } from './dashboard-routes.js';

test('GET /api/v1/admin/dashboards returns dashboards, owners, widgets, and latest audio briefing state', async function () {
  const app = Fastify();

  await registerAdminDashboardRoutes(app, {
    prisma: {
      dashboard: {
        async findMany() {
          return [
            {
              id: 'dash-1',
              name: 'Morning Briefing',
              description: 'Start the day',
              createdAt: new Date('2026-03-25T06:00:00.000Z'),
              updatedAt: new Date('2026-03-25T07:00:00.000Z'),
              owner: {
                id: 'user-1',
                displayName: 'Ralfe',
                email: 'ralfe@example.com'
              },
              widgets: [
                {
                  id: 'widget-1',
                  widgetType: 'weather',
                  title: 'Weather Outlook',
                  isVisible: true,
                  refreshMode: 'SNAPSHOT',
                  updatedAt: new Date('2026-03-25T07:05:00.000Z')
                },
                {
                  id: 'widget-2',
                  widgetType: 'news',
                  title: 'News Briefing',
                  isVisible: true,
                  refreshMode: 'SNAPSHOT',
                  updatedAt: new Date('2026-03-25T07:10:00.000Z')
                }
              ]
            }
          ];
        }
      },
      dashboardBriefing: {
        async findMany() {
          return [
            {
              id: 'brief-1',
              dashboardId: 'dash-1',
              status: 'READY',
              generatedAt: new Date('2026-03-25T07:15:00.000Z'),
              estimatedDurationSeconds: 82,
              errorMessage: null,
              audio: [
                {
                  id: 'audio-1',
                  durationSeconds: 80,
                  generatedAt: new Date('2026-03-25T07:15:05.000Z'),
                  voiceName: 'default'
                }
              ]
            }
          ];
        }
      }
    },
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'admin-1',
          displayName: 'Admin User',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'admin@example.com',
          isAdmin: true
        };
      }
    },
    dashboardBriefingService: {
      async generateBriefing() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboards'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      items: [
        {
          id: 'dash-1',
          name: 'Morning Briefing',
          description: 'Start the day',
          createdAt: '2026-03-25T06:00:00.000Z',
          updatedAt: '2026-03-25T07:00:00.000Z',
          owner: {
            id: 'user-1',
            displayName: 'Ralfe',
            email: 'ralfe@example.com'
          },
          widgetCount: 2,
          widgets: [
            {
              id: 'widget-1',
              type: 'weather',
              title: 'Weather Outlook',
              isVisible: true,
              refreshMode: 'SNAPSHOT',
              updatedAt: '2026-03-25T07:05:00.000Z'
            },
            {
              id: 'widget-2',
              type: 'news',
              title: 'News Briefing',
              isVisible: true,
              refreshMode: 'SNAPSHOT',
              updatedAt: '2026-03-25T07:10:00.000Z'
            }
          ],
          audioBriefing: {
            id: 'brief-1',
            status: 'READY',
            generatedAt: '2026-03-25T07:15:00.000Z',
            estimatedDurationSeconds: 82,
            errorMessage: null,
            audio: {
              id: 'audio-1',
              durationSeconds: 80,
              generatedAt: '2026-03-25T07:15:05.000Z',
              voiceName: 'default'
            }
          }
        }
      ]
    });
  } finally {
    await app.close();
  }
});

test('POST /api/v1/admin/dashboards/:dashboardId/regenerate-audio-briefing regenerates as the dashboard owner', async function () {
  const app = Fastify();

  await registerAdminDashboardRoutes(app, {
    prisma: {
      dashboard: {
        async findMany() {
          throw new Error('not used');
        },
        async findFirst() {
          return {
            id: 'dash-1',
            owner: {
              id: 'owner-1',
              tenantId: 'tenant-1',
              displayName: 'Ralfe',
              timezone: 'Europe/Paris',
              locale: 'en-GB',
              email: 'ralfe@example.com',
              isAdmin: false
            }
          };
        }
      },
      dashboardBriefing: {
        async findMany() {
          throw new Error('not used');
        }
      }
    },
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'admin-1',
          displayName: 'Admin User',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'admin@example.com',
          isAdmin: true
        };
      }
    },
    dashboardBriefingService: {
      async generateBriefing(dashboardId, user, options) {
        assert.equal(dashboardId, 'dash-1');
        assert.equal(user.userId, 'owner-1');
        assert.equal(user.email, 'ralfe@example.com');
        assert.deepEqual(options, {
          force: true
        });

        return {
          briefing: {
            id: 'brief-1',
            dashboardId: 'dash-1',
            status: 'READY',
            sourceSnapshotHash: 'hash-1',
            generatedAt: '2026-03-25T07:15:00.000Z',
            modelName: 'stub',
            promptVersion: 'v1',
            scriptText: 'Hello world',
            scriptJson: {},
            estimatedDurationSeconds: 82,
            errorMessage: null,
            sourceWidgetTypes: ['weather', 'news'],
            createdAt: '2026-03-25T07:14:00.000Z',
            updatedAt: '2026-03-25T07:15:00.000Z',
            audio: null
          },
          reused: false
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/dashboards/dash-1/regenerate-audio-briefing'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().briefing.id, 'brief-1');
  } finally {
    await app.close();
  }
});
