import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { getMessageBrokerConfig } from '../snapshots/message-broker-config.js';
import { readRabbitMqQueueStats } from '../snapshots/rabbitmq-connection.js';
import { getWidgetDefinition } from '../widgets/widget-definitions.js';
export async function registerMessageBrokerRoutes(app, dependencies = createMessageBrokerRouteDependencies()) {
    app.get('/api/v1/admin/message-broker', async function handleGetMessageBrokerOverview(request, reply) {
        const currentUser = await dependencies.defaultUserService.getDefaultUser(request);
        if (!currentUser.isAdmin) {
            reply.code(403);
            return {
                message: 'Admin access is required.'
            };
        }
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
            loadQueueStats(dependencies.brokerProbe, dependencies.brokerConfig)
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
function createMessageBrokerRouteDependencies() {
    const prisma = getPrismaClient();
    const brokerConfig = getMessageBrokerConfig();
    return {
        prisma,
        brokerProbe: brokerConfig.enabled && brokerConfig.url ? { check: () => readRabbitMqQueueStats() } : null,
        brokerConfig,
        defaultUserService: new DefaultUserService(prisma)
    };
}
async function countTodayStatuses(prisma) {
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
async function listChartRows(prisma) {
    const rows = await prisma.$queryRaw `
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
async function loadQueueStats(brokerProbe, brokerConfig) {
    if (!brokerConfig.enabled) {
        return buildQueueStats('disabled', brokerConfig, null, null);
    }
    if (!brokerConfig.url || !brokerProbe) {
        return buildQueueStats('unconfigured', brokerConfig, null, null);
    }
    try {
        const counts = await brokerProbe.check();
        return buildQueueStats('connected', brokerConfig, {
            visibleMessages: counts.readyMessages,
            inFlightMessages: null,
            delayedMessages: counts.retryMessages,
            deadLetterMessages: counts.deadLetterMessages,
            consumerCount: counts.consumerCount,
            totalMessages: counts.readyMessages + counts.retryMessages
        }, null);
    }
    catch (error) {
        return buildQueueStats('error', brokerConfig, null, error instanceof Error ? error.message : 'Unable to read queue attributes.');
    }
}
function buildQueueStats(status, brokerConfig, counts, lastError) {
    return {
        enabled: brokerConfig.enabled,
        queueName: brokerConfig.queue,
        status,
        visibleMessages: counts ? counts.visibleMessages : null,
        inFlightMessages: counts ? counts.inFlightMessages : null,
        delayedMessages: counts ? counts.delayedMessages : null,
        deadLetterMessages: counts ? counts.deadLetterMessages : null,
        consumerCount: counts ? counts.consumerCount : null,
        totalMessages: counts ? counts.totalMessages : null,
        lastError
    };
}
function mapRecentJob(job) {
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
function humanizeWidgetType(widgetType) {
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
