import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerAdminConnectorRoutes } from './connector-routes.js';

test('GET /api/v1/admin/connectors returns safe connector details, owner, and widget usage', async function () {
  const app = Fastify();

  await registerAdminConnectorRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Admin User',
          timezone: 'Europe/Paris',
          email: 'admin@example.com',
          locale: 'en-GB',
          isAdmin: true
        };
      }
    },
    prisma: {
      connector: {
        async findMany() {
          return [
            {
              id: 'connector-1',
              connectorType: 'google-calendar',
              name: 'Work Calendar',
              status: 'ACTIVE',
              authType: 'OAUTH',
              configJson: {
                refreshToken: 'hidden',
                accessToken: 'hidden',
                calendarId: 'work@example.com',
                accountEmail: 'work@example.com',
                accountLabel: 'Work Calendar',
                timezone: 'Europe/Paris'
              },
              createdAt: new Date('2026-03-25T08:00:00.000Z'),
              updatedAt: new Date('2026-03-25T09:00:00.000Z'),
              owner: {
                id: 'user-2',
                displayName: 'Ralfe',
                email: 'ralfe@example.com'
              },
              widgets: [
                {
                  usageRole: 'primary',
                  dashboardWidget: {
                    id: 'widget-1',
                    widgetType: 'calendar',
                    title: 'Today on Calendar',
                    isVisible: true,
                    dashboard: {
                      id: 'dashboard-1',
                      name: 'Morning Briefing',
                      owner: {
                        id: 'user-2',
                        displayName: 'Ralfe',
                        email: 'ralfe@example.com'
                      }
                    }
                  }
                }
              ]
            }
          ];
        }
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/connectors'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      items: [
        {
          id: 'connector-1',
          type: 'google-calendar',
          name: 'Work Calendar',
          status: 'ACTIVE',
          authType: 'OAUTH',
          config: {
            calendarId: 'work@example.com',
            accountEmail: 'work@example.com',
            accountLabel: 'Work Calendar',
            timezone: 'Europe/Paris'
          },
          owner: {
            id: 'user-2',
            displayName: 'Ralfe',
            email: 'ralfe@example.com'
          },
          widgets: [
            {
              usageRole: 'primary',
              widgetId: 'widget-1',
              widgetType: 'calendar',
              widgetTitle: 'Today on Calendar',
              isVisible: true,
              dashboardId: 'dashboard-1',
              dashboardName: 'Morning Briefing',
              dashboardOwner: {
                id: 'user-2',
                displayName: 'Ralfe',
                email: 'ralfe@example.com'
              }
            }
          ],
          createdAt: '2026-03-25T08:00:00.000Z',
          updatedAt: '2026-03-25T09:00:00.000Z'
        }
      ]
    });
  } finally {
    await app.close();
  }
});

test('GET /api/v1/admin/connectors requires admin access', async function () {
  const app = Fastify();

  await registerAdminConnectorRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Standard User',
          timezone: 'Europe/Paris',
          email: 'user@example.com',
          locale: 'en-GB',
          isAdmin: false
        };
      }
    },
    prisma: {
      connector: {
        async findMany() {
          throw new Error('not used');
        }
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/connectors'
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), {
      message: 'Admin access is required.'
    });
  } finally {
    await app.close();
  }
});
