import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerMessageBrokerRoutes } from './message-broker-routes.js';

type MessageBrokerRouteDependencies = NonNullable<Parameters<typeof registerMessageBrokerRoutes>[1]>;
type JobCountInput = { where?: { status?: string; completedAt?: unknown } };
type MessageBrokerPrismaFixture = {
  $queryRaw(query?: unknown, ...values: unknown[]): Promise<unknown>;
  snapshotGenerationJob: {
    count(input?: JobCountInput): Promise<number>;
    findMany(input?: unknown): Promise<unknown[]>;
  };
};

function messageBrokerPrisma(fixture: MessageBrokerPrismaFixture): MessageBrokerRouteDependencies['prisma'] {
  return fixture as unknown as MessageBrokerRouteDependencies['prisma'];
}

test('GET /api/v1/admin/message-broker returns queue metrics, chart data, and recent messages', async function () {
  const app = Fastify();

  await registerMessageBrokerRoutes(app, {
    prisma: messageBrokerPrisma({
      $queryRaw: async function $queryRaw() {
        return [
          {
            day: new Date('2026-03-18T00:00:00.000Z'),
            publishedCount: 4,
            processedCount: 3
          },
          {
            day: new Date('2026-03-19T00:00:00.000Z'),
            publishedCount: 6,
            processedCount: 5
          }
        ];
      },
      snapshotGenerationJob: {
        count: async function count(args) {
          if (args?.where?.status === 'PENDING') {
            return 2;
          }

          if (args?.where?.status === 'PROCESSING') {
            return 1;
          }

          if (args?.where?.status === 'FAILED') {
            return 1;
          }

          if (args?.where?.completedAt) {
            return 5;
          }

          return 6;
        },
        findMany: async function findMany() {
          return [
            {
              id: 'job-1',
              widgetId: 'widget-1',
              dashboardId: 'dash-1',
              widget: {
                widgetType: 'weather',
                title: 'Weather Outlook'
              },
              snapshotDate: new Date('2026-03-19T00:00:00.000Z'),
              triggerSource: 'widget_updated',
              idempotencyKey: 'widget-1:2026-03-19:hash',
              status: 'COMPLETED',
              attemptCount: 1,
              lastMessageId: 'msg-1',
              lastError: null,
              startedAt: new Date('2026-03-19T08:01:00.000Z'),
              completedAt: new Date('2026-03-19T08:02:00.000Z'),
              createdAt: new Date('2026-03-19T08:00:00.000Z'),
              updatedAt: new Date('2026-03-19T08:02:00.000Z')
            }
          ];
        }
      }
    }),
    brokerProbe: {
      async check() {
        return {
          readyMessages: 7,
          retryMessages: 1,
          deadLetterMessages: 3,
          consumerCount: 1
        };
      }
    },
    brokerConfig: {
      enabled: true,
      url: 'amqp://user:secret@rabbitmq:5672',
      exchange: 'morning-briefing.jobs',
      queue: 'morning-briefing.jobs',
      retryQueue: 'morning-briefing.jobs.retry',
      dlq: 'morning-briefing.jobs.dlq',
      mainRoutingKey: 'jobs',
      retryRoutingKey: 'retry',
      deadLetterRoutingKey: 'dead',
      retryDelayMs: 30000,
      maxAttempts: 5,
      prefetch: 5,
      reconnectDelayMs: 1000,
      jobLeaseSeconds: 300,
      workerHealthFile: '/tmp/worker-ready'
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
      url: '/api/v1/admin/message-broker'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      queue: {
        enabled: true,
        queueName: 'morning-briefing.jobs',
        status: 'connected',
        visibleMessages: 7,
        inFlightMessages: null,
        delayedMessages: 1,
        deadLetterMessages: 3,
        consumerCount: 1,
        totalMessages: 8,
        lastError: null
      },
      overview: {
        pendingJobs: 2,
        processingJobs: 1,
        publishedToday: 6,
        processedToday: 5,
        failedToday: 1
      },
      chart: [
        {
          date: '2026-03-18',
          published: 4,
          processed: 3
        },
        {
          date: '2026-03-19',
          published: 6,
          processed: 5
        }
      ],
      recentMessages: [
        {
          id: 'job-1',
          widgetId: 'widget-1',
          dashboardId: 'dash-1',
          widgetType: 'weather',
          widgetTypeLabel: 'Weather',
          widgetTitle: 'Weather Outlook',
          snapshotDate: '2026-03-19',
          triggerSource: 'widget_updated',
          idempotencyKey: 'widget-1:2026-03-19:hash',
          status: 'COMPLETED',
          attemptCount: 1,
          lastMessageId: 'msg-1',
          lastError: null,
          startedAt: '2026-03-19T08:01:00.000Z',
          completedAt: '2026-03-19T08:02:00.000Z',
          createdAt: '2026-03-19T08:00:00.000Z',
          updatedAt: '2026-03-19T08:02:00.000Z'
        }
      ]
    });
  } finally {
    await app.close();
  }
});

test('GET /api/v1/admin/message-broker reports an unconfigured queue when no queue url is present', async function () {
  const app = Fastify();

  await registerMessageBrokerRoutes(app, {
    prisma: messageBrokerPrisma({
      $queryRaw: async function $queryRaw() {
        return [];
      },
      snapshotGenerationJob: {
        count: async function count() {
          return 0;
        },
        findMany: async function findMany() {
          return [];
        }
      }
    }),
    brokerProbe: null,
    brokerConfig: {
      enabled: true,
      url: null,
      exchange: 'morning-briefing.jobs',
      queue: 'morning-briefing-snapshot-jobs',
      retryQueue: 'morning-briefing-snapshot-jobs-retry',
      dlq: 'morning-briefing-snapshot-jobs-dlq',
      mainRoutingKey: 'jobs',
      retryRoutingKey: 'retry',
      deadLetterRoutingKey: 'dead',
      retryDelayMs: 30000,
      maxAttempts: 5,
      prefetch: 5,
      reconnectDelayMs: 1000,
      jobLeaseSeconds: 300,
      workerHealthFile: '/tmp/worker-ready'
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
      url: '/api/v1/admin/message-broker'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().queue.status, 'unconfigured');
    assert.equal(response.json().queue.totalMessages, null);
  } finally {
    await app.close();
  }
});
