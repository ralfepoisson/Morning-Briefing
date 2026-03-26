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
              isGenerating: true,
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
    dashboardBriefingJobPublisher: {
      async publishGenerateDashboardAudioBriefing() {
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
          isGenerating: true,
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

test('GET /api/v1/admin/dashboards falls back when dashboard generating schema is unavailable', async function () {
  const app = Fastify();
  let callCount = 0;

  await registerAdminDashboardRoutes(app, {
    prisma: {
      dashboard: {
        async findMany() {
          callCount += 1;

          if (callCount === 1) {
            throw new Error('The column `dashboards.is_generating` does not exist in the current database.');
          }

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
              widgets: []
            }
          ];
        }
      },
      dashboardBriefing: {
        async findMany() {
          return [];
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
    dashboardBriefingJobPublisher: {
      async publishGenerateDashboardAudioBriefing() {
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
    assert.equal(callCount, 2);
    assert.equal(response.json().items[0].isGenerating, false);
  } finally {
    await app.close();
  }
});

test('POST /api/v1/admin/dashboards/:dashboardId/regenerate-audio-briefing queues async generation as the dashboard owner', async function () {
  const app = Fastify();
  let publishedInput = null;
  const dashboardUpdates = [];

  await registerAdminDashboardRoutes(app, {
    prisma: {
      dashboard: {
        async findMany() {
          throw new Error('not used');
        },
        async update(input) {
          dashboardUpdates.push(input);
          return {};
        },
        async findFirst() {
          return {
            id: 'dash-1',
            isGenerating: false,
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
    dashboardBriefingJobPublisher: {
      async publishGenerateDashboardAudioBriefing(input) {
        publishedInput = input;
        return {
          schemaVersion: 1,
          jobId: 'job-1',
          dashboardId: input.dashboardId,
          tenantId: input.tenantId,
          ownerUserId: input.ownerUserId,
          ownerDisplayName: input.ownerDisplayName,
          ownerTimezone: input.ownerTimezone,
          ownerLocale: input.ownerLocale,
          ownerEmail: input.ownerEmail,
          ownerIsAdmin: input.ownerIsAdmin,
          force: input.force,
          correlationId: input.correlationId || null,
          causationId: input.causationId || null,
          requestedAt: '2026-03-25T07:14:00.000Z'
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/dashboards/dash-1/regenerate-audio-briefing'
    });

    assert.equal(response.statusCode, 202);
    assert.equal((publishedInput as { ownerUserId: string }).ownerUserId, 'owner-1');
    assert.equal((publishedInput as { ownerEmail: string }).ownerEmail, 'ralfe@example.com');
    assert.deepEqual(dashboardUpdates.map(function mapUpdate(item) {
      return (item as { data: { isGenerating: boolean } }).data.isGenerating;
    }), [true]);
    assert.deepEqual(response.json(), {
      status: 'queued',
      job: {
        dashboardId: 'dash-1',
        force: true,
        requestedAt: '2026-03-25T07:14:00.000Z'
      }
    });
  } finally {
    await app.close();
  }
});
