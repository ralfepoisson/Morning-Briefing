import { GetQueueAttributesCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { createSnapshotSqsClient } from '../snapshots/snapshot-sqs-client.js';
import { getSnapshotQueueConfig } from '../snapshots/snapshot-queue-config.js';
import { getWidgetDefinition } from '../widgets/widget-definitions.js';

type MessageBrokerRouteDependencies = {
  prisma: Pick<
    PrismaClient,
    '$queryRaw' | 'snapshotGenerationJob'
  >;
  sqs: Pick<SQSClient, 'send'> | null;
  queueConfig: ReturnType<typeof getSnapshotQueueConfig>;
};

type DailyChartRow = {
  day: Date;
  publishedCount: bigint | number;
  processedCount: bigint | number;
};

type RecentJobRecord = {
  id: string;
  widgetId: string;
  dashboardId: string;
  snapshotDate: Date;
  triggerSource: string;
  idempotencyKey: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  attemptCount: number;
  lastMessageId: string | null;
  lastError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  widget?: {
    widgetType: string;
    title: string;
  } | null;
};

export async function registerMessageBrokerRoutes(
  app: FastifyInstance,
  dependencies: MessageBrokerRouteDependencies = createMessageBrokerRouteDependencies()
): Promise<void> {
  app.get('/api/v1/admin/message-broker', async function handleGetMessageBrokerOverview() {
    const [pendingCount, processingCount, recentJobs, chartRows, todayCounts, queueStats] = await Promise.all([
      dependencies.prisma.snapshotGenerationJob.count({
        where: {
          status: 'PENDING'
        }
      }),
      dependencies.prisma.snapshotGenerationJob.count({
        where: {
          status: 'PROCESSING'
        }
      }),
      dependencies.prisma.snapshotGenerationJob.findMany({
        include: {
          widget: {
            select: {
              widgetType: true,
              title: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 12
      }),
      listChartRows(dependencies.prisma),
      countTodayStatuses(dependencies.prisma),
      loadQueueStats(dependencies.sqs, dependencies.queueConfig)
    ]);

    return {
      queue: queueStats,
      overview: {
        pendingJobs: pendingCount,
        processingJobs: processingCount,
        publishedToday: todayCounts.publishedToday,
        processedToday: todayCounts.processedToday,
        failedToday: todayCounts.failedToday
      },
      chart: chartRows.map(function mapChartRow(row) {
        return {
          date: row.date,
          published: row.published,
          processed: row.processed
        };
      }),
      recentMessages: recentJobs.map(mapRecentJob)
    };
  });
}

function createMessageBrokerRouteDependencies(): MessageBrokerRouteDependencies {
  const queueConfig = getSnapshotQueueConfig();

  return {
    prisma: getPrismaClient(),
    sqs: queueConfig.enabled && queueConfig.queueUrl ? createSnapshotSqsClient() : null,
    queueConfig
  };
}

async function countTodayStatuses(prisma: MessageBrokerRouteDependencies['prisma']): Promise<{
  publishedToday: number;
  processedToday: number;
  failedToday: number;
}> {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const [publishedToday, processedToday, failedToday] = await Promise.all([
    prisma.snapshotGenerationJob.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    }),
    prisma.snapshotGenerationJob.count({
      where: {
        status: {
          in: ['COMPLETED', 'FAILED', 'SKIPPED']
        },
        completedAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    }),
    prisma.snapshotGenerationJob.count({
      where: {
        status: 'FAILED',
        completedAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    })
  ]);

  return {
    publishedToday,
    processedToday,
    failedToday
  };
}

async function listChartRows(prisma: MessageBrokerRouteDependencies['prisma']): Promise<Array<{
  date: string;
  published: number;
  processed: number;
}>> {
  const rows = await prisma.$queryRaw<DailyChartRow[]>`
    SELECT
      days.day_bucket AS day,
      COALESCE(published.published_count, 0) AS "publishedCount",
      COALESCE(processed.processed_count, 0) AS "processedCount"
    FROM generate_series(
      date_trunc('day', now()) - interval '6 day',
      date_trunc('day', now()),
      interval '1 day'
    ) AS days(day_bucket)
    LEFT JOIN (
      SELECT
        date_trunc('day', created_at) AS day_bucket,
        COUNT(*) AS published_count
      FROM snapshot_generation_jobs
      GROUP BY 1
    ) AS published
      ON published.day_bucket = days.day_bucket
    LEFT JOIN (
      SELECT
        date_trunc('day', completed_at) AS day_bucket,
        COUNT(*) AS processed_count
      FROM snapshot_generation_jobs
      WHERE status IN ('COMPLETED', 'FAILED', 'SKIPPED')
      GROUP BY 1
    ) AS processed
      ON processed.day_bucket = days.day_bucket
    ORDER BY days.day_bucket ASC
  `;

  return rows.map(function mapRow(row) {
    return {
      date: row.day.toISOString().slice(0, 10),
      published: Number(row.publishedCount),
      processed: Number(row.processedCount)
    };
  });
}

async function loadQueueStats(
  sqs: Pick<SQSClient, 'send'> | null,
  queueConfig: ReturnType<typeof getSnapshotQueueConfig>
): Promise<{
  enabled: boolean;
  queueName: string;
  queueUrl: string | null;
  status: 'connected' | 'disabled' | 'unconfigured' | 'error';
  visibleMessages: number | null;
  inFlightMessages: number | null;
  delayedMessages: number | null;
  totalMessages: number | null;
  lastError: string | null;
}> {
  if (!queueConfig.enabled) {
    return buildQueueStats('disabled', queueConfig, null, null);
  }

  if (!queueConfig.queueUrl || !sqs) {
    return buildQueueStats('unconfigured', queueConfig, null, null);
  }

  try {
    const response = await sqs.send(new GetQueueAttributesCommand({
      QueueUrl: queueConfig.queueUrl,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
        'ApproximateNumberOfMessagesDelayed'
      ]
    }));

    const visibleMessages = Number(response.Attributes?.ApproximateNumberOfMessages || 0);
    const inFlightMessages = Number(response.Attributes?.ApproximateNumberOfMessagesNotVisible || 0);
    const delayedMessages = Number(response.Attributes?.ApproximateNumberOfMessagesDelayed || 0);

    return buildQueueStats('connected', queueConfig, {
      visibleMessages,
      inFlightMessages,
      delayedMessages,
      totalMessages: visibleMessages + inFlightMessages + delayedMessages
    }, null);
  } catch (error) {
    return buildQueueStats(
      'error',
      queueConfig,
      null,
      error instanceof Error ? error.message : 'Unable to read queue attributes.'
    );
  }
}

function buildQueueStats(
  status: 'connected' | 'disabled' | 'unconfigured' | 'error',
  queueConfig: ReturnType<typeof getSnapshotQueueConfig>,
  counts: {
    visibleMessages: number;
    inFlightMessages: number;
    delayedMessages: number;
    totalMessages: number;
  } | null,
  lastError: string | null
) {
  return {
    enabled: queueConfig.enabled,
    queueName: queueConfig.queueName,
    queueUrl: queueConfig.queueUrl,
    status,
    visibleMessages: counts ? counts.visibleMessages : null,
    inFlightMessages: counts ? counts.inFlightMessages : null,
    delayedMessages: counts ? counts.delayedMessages : null,
    totalMessages: counts ? counts.totalMessages : null,
    lastError
  };
}

function mapRecentJob(job: RecentJobRecord) {
  const widgetType = job.widget ? job.widget.widgetType : null;
  const definition = widgetType ? getWidgetDefinition(widgetType) : null;

  return {
    id: job.id,
    widgetId: job.widgetId,
    dashboardId: job.dashboardId,
    widgetType,
    widgetTypeLabel: definition ? definition.name : humanizeWidgetType(widgetType),
    widgetTitle: job.widget ? job.widget.title : null,
    snapshotDate: job.snapshotDate.toISOString().slice(0, 10),
    triggerSource: job.triggerSource,
    idempotencyKey: job.idempotencyKey,
    status: job.status,
    attemptCount: job.attemptCount,
    lastMessageId: job.lastMessageId,
    lastError: job.lastError,
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

function humanizeWidgetType(widgetType: string | null): string {
  if (!widgetType) {
    return 'Unknown widget';
  }

  return widgetType
    .split(/[-_]/g)
    .filter(Boolean)
    .map(function capitalizeWord(word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
