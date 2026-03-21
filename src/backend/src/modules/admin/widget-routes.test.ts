import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerAdminWidgetRoutes } from './widget-routes.js';

test('GET /api/v1/admin/widgets returns widgets with latest snapshot state', async function () {
  const app = Fastify();

  await registerAdminWidgetRoutes(app, {
    prisma: {
      dashboardWidget: {
        findMany: async function findMany() {
          return [
            {
              id: 'widget-1',
              dashboardId: 'dash-1',
              widgetType: 'weather',
              title: 'Weather Outlook',
              isVisible: true,
              refreshMode: 'SNAPSHOT',
              version: 3,
              configHash: 'hash-1',
              createdAt: new Date('2026-03-18T08:00:00.000Z'),
              updatedAt: new Date('2026-03-19T08:00:00.000Z'),
              dashboard: {
                id: 'dash-1',
                name: 'Personal',
                ownerUserId: 'user-1'
              },
              snapshots: [
                {
                  status: 'FAILED',
                  errorMessage: 'Provider timeout',
                  contentJson: {
                    summary: 'Weather provider timeout',
                    details: []
                  },
                  generatedAt: new Date('2026-03-20T06:15:00.000Z'),
                  snapshot: {
                    snapshotDate: new Date('2026-03-20T00:00:00.000Z')
                  }
                }
              ],
              snapshotJobs: [
                {
                  status: 'COMPLETED',
                  triggerSource: 'manual_refresh',
                  duplicateSkipCount: 2,
                  lastDuplicateAt: new Date('2026-03-20T06:20:00.000Z'),
                  createdAt: new Date('2026-03-20T06:15:00.000Z')
                }
              ]
            },
            {
              id: 'widget-2',
              dashboardId: 'dash-1',
              widgetType: 'news',
              title: 'News Briefing',
              isVisible: true,
              refreshMode: 'SNAPSHOT',
              version: 2,
              configHash: 'hash-2',
              createdAt: new Date('2026-03-17T08:00:00.000Z'),
              updatedAt: new Date('2026-03-19T09:00:00.000Z'),
              dashboard: {
                id: 'dash-1',
                name: 'Personal',
                ownerUserId: 'user-1'
              },
              snapshots: [],
              snapshotJobs: []
            }
          ];
        },
        findFirst: async function findFirst() {
          return null;
        }
      }
    } as never,
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
    snapshotJobPublisher: {
      async publishGenerateWidgetSnapshot() {
        throw new Error('not used');
      }
    },
    snapshotService: {
      async generateForWidget() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/widgets'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      items: [
        {
          id: 'widget-1',
          dashboardId: 'dash-1',
          dashboardName: 'Personal',
          type: 'weather',
          title: 'Weather Outlook',
          isVisible: true,
          refreshMode: 'SNAPSHOT',
          latestSnapshotAt: '2026-03-20T06:15:00.000Z',
          latestSnapshotDate: '2026-03-20',
          latestSnapshotStatus: 'FAILED',
          latestErrorMessage: 'Provider timeout',
          latestSnapshotContent: {
            summary: 'Weather provider timeout',
            details: []
          },
          duplicateSkipCount: 2,
          latestDuplicateAt: '2026-03-20T06:20:00.000Z',
          isFailing: true,
          createdAt: '2026-03-18T08:00:00.000Z',
          updatedAt: '2026-03-19T08:00:00.000Z'
        },
        {
          id: 'widget-2',
          dashboardId: 'dash-1',
          dashboardName: 'Personal',
          type: 'news',
          title: 'News Briefing',
          isVisible: true,
          refreshMode: 'SNAPSHOT',
          latestSnapshotAt: null,
          latestSnapshotDate: null,
          latestSnapshotStatus: null,
          latestErrorMessage: null,
          latestSnapshotContent: null,
          duplicateSkipCount: 0,
          latestDuplicateAt: null,
          isFailing: false,
          createdAt: '2026-03-17T08:00:00.000Z',
          updatedAt: '2026-03-19T09:00:00.000Z'
        }
      ]
    });
  } finally {
    await app.close();
  }
});

test('POST /api/v1/admin/widgets/:widgetId/regenerate-snapshot enqueues a manual refresh', async function () {
  const app = Fastify();
  let publishedInput = null;

  await registerAdminWidgetRoutes(app, {
    prisma: {
      dashboardWidget: {
        findMany: async function findMany() {
          return [];
        },
        findFirst: async function findFirst() {
          return {
            id: 'widget-1',
            tenantId: 'tenant-1',
            dashboardId: 'dash-1',
            widgetType: 'weather',
            title: 'Weather Outlook',
            refreshMode: 'SNAPSHOT',
            version: 4,
            configHash: 'hash-1',
            dashboard: {
              id: 'dash-1',
              ownerUserId: 'user-1'
            }
          };
        }
      }
    } as never,
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
    snapshotJobPublisher: {
      async publishGenerateWidgetSnapshot(input) {
        publishedInput = input;

        return {
          schemaVersion: 1,
          jobId: 'job-1',
          idempotencyKey: 'widget-1:2026-03-21:hash-1:manual-bypass:2026-03-20T07:30:00.000Z',
          widgetId: input.widgetId,
          dashboardId: input.dashboardId,
          tenantId: input.tenantId,
          userId: input.userId,
          widgetConfigVersion: input.widgetConfigVersion,
          widgetConfigHash: input.widgetConfigHash,
          snapshotDate: input.snapshotDate,
          snapshotPeriod: 'day',
          triggerSource: input.triggerSource,
          bypassDuplicateCheck: input.bypassDuplicateCheck === true,
          correlationId: input.correlationId || null,
          causationId: input.causationId || null,
          requestedAt: '2026-03-20T07:30:00.000Z'
        };
      }
    },
    snapshotService: {
      async generateForWidget() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/widgets/widget-1/regenerate-snapshot',
      payload: {
        bypassDuplicateCheck: true
      }
    });

    assert.equal(response.statusCode, 202);
    assert.equal((publishedInput as { triggerSource: string }).triggerSource, 'manual_refresh');
    assert.equal((publishedInput as { bypassDuplicateCheck: boolean }).bypassDuplicateCheck, true);
    assert.equal((publishedInput as { snapshotDate: string }).snapshotDate, '2026-03-21');
    assert.deepEqual(response.json(), {
      status: 'queued',
      job: {
        widgetId: 'widget-1',
        snapshotDate: '2026-03-21',
        triggerSource: 'manual_refresh',
        bypassDuplicateCheck: true,
        requestedAt: '2026-03-20T07:30:00.000Z'
      }
    });
  } finally {
    await app.close();
  }
});

test('POST /api/v1/admin/widgets/:widgetId/regenerate-snapshot falls back to direct generation when queue publishing fails', async function () {
  const app = Fastify();
  let generatedInput = null;

  await registerAdminWidgetRoutes(app, {
    prisma: {
      dashboardWidget: {
        findMany: async function findMany() {
          return [];
        },
        findFirst: async function findFirst() {
          return {
            id: 'widget-1',
            tenantId: 'tenant-1',
            dashboardId: 'dash-1',
            widgetType: 'news',
            title: 'News Briefing',
            refreshMode: 'SNAPSHOT',
            version: 4,
            configHash: 'hash-news',
            dashboard: {
              id: 'dash-1',
              ownerUserId: 'user-1'
            }
          };
        }
      }
    } as never,
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
    snapshotJobPublisher: {
      async publishGenerateWidgetSnapshot() {
        throw new Error('connect ECONNREFUSED 127.0.0.1:4566');
      }
    },
    snapshotService: {
      async generateForWidget(input) {
        generatedInput = input;

        return {
          status: 'generated'
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/widgets/widget-1/regenerate-snapshot',
      payload: {
        bypassDuplicateCheck: true
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal((generatedInput as { triggerSource: string }).triggerSource, 'manual_refresh');
    assert.equal((generatedInput as { snapshotDate: string }).snapshotDate, '2026-03-21');
    assert.deepEqual(response.json(), {
      status: 'generated',
      mode: 'direct',
      message: 'connect ECONNREFUSED 127.0.0.1:4566',
      job: {
        widgetId: 'widget-1',
        snapshotDate: '2026-03-21',
        triggerSource: 'manual_refresh',
        bypassDuplicateCheck: true
      }
    });
  } finally {
    await app.close();
  }
});
