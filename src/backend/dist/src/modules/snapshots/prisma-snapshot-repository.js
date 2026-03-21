import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getWidgetDefinition } from '../widgets/widget-definitions.js';
import { hashWidgetConfig } from './snapshot-job-utils.js';
import { parseSnapshotDate } from './snapshot-date.js';
export class PrismaSnapshotRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findDashboardWithWidgets(dashboardId, ownerUserId) {
        const dashboard = await this.prisma.dashboard.findFirst({
            where: {
                id: dashboardId,
                ownerUserId,
                archivedAt: null
            },
            include: {
                widgets: {
                    where: {
                        archivedAt: null
                    },
                    include: {
                        connectors: {
                            include: {
                                connector: true
                            }
                        }
                    },
                    orderBy: [
                        { sortOrder: 'asc' },
                        { createdAt: 'asc' }
                    ]
                }
            }
        });
        if (!dashboard) {
            return null;
        }
        return {
            id: dashboard.id,
            tenantId: dashboard.tenantId,
            ownerUserId: dashboard.ownerUserId,
            name: dashboard.name,
            description: dashboard.description || '',
            widgets: dashboard.widgets.map(mapDashboardWidgetRecord)
        };
    }
    async findLatestDashboardSnapshot(dashboardId, userId) {
        const snapshot = await this.prisma.briefingSnapshot.findFirst({
            where: {
                dashboardId,
                userId
            },
            include: {
                widgetSnapshots: {
                    orderBy: [
                        { generatedAt: 'desc' },
                        { id: 'asc' }
                    ]
                }
            },
            orderBy: [
                { snapshotDate: 'desc' },
                { generatedAt: 'desc' }
            ]
        });
        if (!snapshot) {
            return null;
        }
        return {
            id: snapshot.id,
            dashboardId: snapshot.dashboardId,
            userId: snapshot.userId,
            snapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
            generationStatus: snapshot.generationStatus,
            summary: asObject(snapshot.summaryJson),
            generatedAt: snapshot.generatedAt,
            widgets: snapshot.widgetSnapshots.map(mapWidgetSnapshotRecord)
        };
    }
    async upsertDashboardSnapshot(input) {
        const snapshot = await this.prisma.briefingSnapshot.upsert({
            where: {
                userId_dashboardId_snapshotDate: {
                    userId: input.userId,
                    dashboardId: input.dashboardId,
                    snapshotDate: input.snapshotDate
                }
            },
            update: {
                generationStatus: input.generationStatus,
                summaryJson: input.summary,
                generatedAt: new Date()
            },
            create: {
                tenantId: input.tenantId,
                userId: input.userId,
                dashboardId: input.dashboardId,
                snapshotDate: input.snapshotDate,
                generationStatus: input.generationStatus,
                summaryJson: input.summary
            }
        });
        const widgetSnapshots = [];
        for (const widget of input.widgets) {
            const contentHash = createHash('sha256').update(JSON.stringify(widget.content || {})).digest('hex');
            const savedWidgetSnapshot = await this.prisma.widgetSnapshot.upsert({
                where: {
                    snapshotId_dashboardWidgetId: {
                        snapshotId: snapshot.id,
                        dashboardWidgetId: widget.widgetId
                    }
                },
                update: {
                    widgetType: widget.widgetType,
                    title: widget.title,
                    status: widget.status,
                    contentJson: widget.content,
                    contentHash,
                    errorMessage: widget.errorMessage,
                    generatedAt: widget.generatedAt
                },
                create: {
                    snapshotId: snapshot.id,
                    dashboardWidgetId: widget.widgetId,
                    widgetType: widget.widgetType,
                    title: widget.title,
                    status: widget.status,
                    contentJson: widget.content,
                    contentHash,
                    errorMessage: widget.errorMessage,
                    generatedAt: widget.generatedAt
                }
            });
            widgetSnapshots.push(mapWidgetSnapshotRecord(savedWidgetSnapshot));
        }
        return {
            id: snapshot.id,
            dashboardId: snapshot.dashboardId,
            userId: snapshot.userId,
            snapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
            generationStatus: snapshot.generationStatus,
            summary: asObject(snapshot.summaryJson),
            generatedAt: snapshot.generatedAt,
            widgets: widgetSnapshots
        };
    }
    async findWidgetForSnapshotGeneration(widgetId) {
        const widget = await this.prisma.dashboardWidget.findFirst({
            where: {
                id: widgetId,
                archivedAt: null,
                dashboard: {
                    archivedAt: null
                }
            },
            include: {
                dashboard: true,
                connectors: {
                    include: {
                        connector: true
                    }
                }
            }
        });
        return widget ? mapDashboardWidgetRecord(widget) : null;
    }
    async listWidgetsForScheduledRefresh() {
        const widgets = await this.prisma.dashboardWidget.findMany({
            where: {
                archivedAt: null,
                isVisible: true,
                refreshMode: {
                    in: ['SNAPSHOT', 'HYBRID']
                },
                dashboard: {
                    isActive: true,
                    archivedAt: null,
                    owner: {
                        isActive: true
                    }
                }
            },
            include: {
                dashboard: true,
                connectors: {
                    include: {
                        connector: true
                    }
                }
            },
            orderBy: [
                { dashboardId: 'asc' },
                { sortOrder: 'asc' }
            ]
        });
        return widgets.map(mapDashboardWidgetRecord);
    }
    async claimSnapshotJob(message, messageReceiptId) {
        const now = new Date();
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const existing = await this.prisma.snapshotGenerationJob.findUnique({
                where: {
                    idempotencyKey: message.idempotencyKey
                }
            });
            if (existing) {
                if (existing.status === 'COMPLETED' || existing.status === 'SKIPPED') {
                    return {
                        status: 'already_processed',
                        jobId: existing.id
                    };
                }
                if (existing.status === 'PROCESSING') {
                    return {
                        status: 'already_processing',
                        jobId: existing.id
                    };
                }
                const updated = await this.prisma.snapshotGenerationJob.update({
                    where: {
                        id: existing.id
                    },
                    data: {
                        status: 'PROCESSING',
                        attemptCount: {
                            increment: 1
                        },
                        lastMessageId: messageReceiptId,
                        lastError: null,
                        startedAt: now,
                        completedAt: null
                    }
                });
                return {
                    status: 'claimed',
                    jobId: updated.id,
                    attemptCount: updated.attemptCount
                };
            }
            try {
                const created = await this.prisma.snapshotGenerationJob.create({
                    data: {
                        widgetId: message.widgetId,
                        dashboardId: message.dashboardId,
                        tenantId: message.tenantId,
                        userId: message.userId,
                        snapshotDate: parseSnapshotDate(message.snapshotDate),
                        triggerSource: message.triggerSource,
                        idempotencyKey: message.idempotencyKey,
                        requestedConfigVersion: message.widgetConfigVersion,
                        requestedConfigHash: message.widgetConfigHash,
                        status: 'PROCESSING',
                        attemptCount: 1,
                        lastMessageId: messageReceiptId,
                        startedAt: now
                    }
                });
                return {
                    status: 'claimed',
                    jobId: created.id,
                    attemptCount: created.attemptCount
                };
            }
            catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                    continue;
                }
                throw error;
            }
        }
        const created = await this.prisma.snapshotGenerationJob.findUniqueOrThrow({
            where: {
                idempotencyKey: message.idempotencyKey
            }
        });
        return {
            status: created.status === 'PROCESSING' ? 'already_processing' : 'already_processed',
            jobId: created.id
        };
    }
    async completeSnapshotJob(idempotencyKey) {
        await this.prisma.snapshotGenerationJob.update({
            where: {
                idempotencyKey
            },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                lastError: null
            }
        });
    }
    async skipSnapshotJob(idempotencyKey, reason) {
        await this.prisma.snapshotGenerationJob.update({
            where: {
                idempotencyKey
            },
            data: {
                status: 'SKIPPED',
                completedAt: new Date(),
                lastError: reason
            }
        });
    }
    async failSnapshotJob(idempotencyKey, reason) {
        await this.prisma.snapshotGenerationJob.update({
            where: {
                idempotencyKey
            },
            data: {
                status: 'FAILED',
                completedAt: new Date(),
                lastError: reason
            }
        });
    }
    async upsertWidgetSnapshot(input) {
        const snapshotDate = parseSnapshotDate(input.snapshotDate);
        await this.prisma.$transaction(async (tx) => {
            const briefingSnapshot = await tx.briefingSnapshot.upsert({
                where: {
                    userId_dashboardId_snapshotDate: {
                        userId: input.widget.ownerUserId,
                        dashboardId: input.widget.dashboardId,
                        snapshotDate
                    }
                },
                update: {
                    generatedAt: input.widgetSnapshot.generatedAt
                },
                create: {
                    tenantId: input.widget.tenantId,
                    userId: input.widget.ownerUserId,
                    dashboardId: input.widget.dashboardId,
                    snapshotDate,
                    generationStatus: 'PENDING',
                    summaryJson: {}
                }
            });
            const contentHash = createHash('sha256')
                .update(JSON.stringify(input.widgetSnapshot.content || {}))
                .digest('hex');
            await tx.widgetSnapshot.upsert({
                where: {
                    snapshotId_dashboardWidgetId: {
                        snapshotId: briefingSnapshot.id,
                        dashboardWidgetId: input.widget.id
                    }
                },
                update: {
                    widgetType: input.widgetSnapshot.widgetType,
                    title: input.widgetSnapshot.title,
                    status: input.widgetSnapshot.status,
                    contentJson: input.widgetSnapshot.content,
                    contentHash,
                    errorMessage: input.widgetSnapshot.errorMessage,
                    generatedAt: input.widgetSnapshot.generatedAt
                },
                create: {
                    snapshotId: briefingSnapshot.id,
                    dashboardWidgetId: input.widget.id,
                    widgetType: input.widgetSnapshot.widgetType,
                    title: input.widgetSnapshot.title,
                    status: input.widgetSnapshot.status,
                    contentJson: input.widgetSnapshot.content,
                    contentHash,
                    errorMessage: input.widgetSnapshot.errorMessage,
                    generatedAt: input.widgetSnapshot.generatedAt
                }
            });
            const [eligibleWidgets, widgetSnapshots] = await Promise.all([
                tx.dashboardWidget.findMany({
                    where: {
                        dashboardId: input.widget.dashboardId,
                        archivedAt: null,
                        isVisible: true,
                        refreshMode: {
                            in: ['SNAPSHOT', 'HYBRID']
                        }
                    },
                    orderBy: [
                        { sortOrder: 'asc' },
                        { createdAt: 'asc' }
                    ]
                }),
                tx.widgetSnapshot.findMany({
                    where: {
                        snapshotId: briefingSnapshot.id
                    },
                    orderBy: {
                        generatedAt: 'desc'
                    }
                })
            ]);
            const snapshotStatus = computeDashboardSnapshotStatus(eligibleWidgets, widgetSnapshots);
            const summary = buildDashboardSummary(widgetSnapshots);
            await tx.briefingSnapshot.update({
                where: {
                    id: briefingSnapshot.id
                },
                data: {
                    generationStatus: snapshotStatus,
                    summaryJson: summary,
                    generatedAt: input.widgetSnapshot.generatedAt
                }
            });
        });
    }
}
function computeDashboardSnapshotStatus(eligibleWidgets, widgetSnapshots) {
    if (!eligibleWidgets.length) {
        return 'READY';
    }
    const widgetSnapshotById = new Map(widgetSnapshots.map(function mapSnapshot(snapshot) {
        return [snapshot.dashboardWidgetId, snapshot];
    }));
    const statuses = eligibleWidgets.map(function mapWidget(widget) {
        return widgetSnapshotById.get(widget.id)?.status || 'PENDING';
    });
    if (statuses.includes('PENDING')) {
        return 'PENDING';
    }
    if (statuses.every(function isReady(status) {
        return status === 'READY';
    })) {
        return 'READY';
    }
    return 'FAILED';
}
function buildDashboardSummary(widgetSnapshots) {
    const newsSummary = widgetSnapshots.find(function findNews(snapshot) {
        return snapshot.widgetType === 'news' && snapshot.status === 'READY';
    });
    if (newsSummary) {
        const content = asObject(newsSummary.contentJson);
        if (typeof content.headline === 'string' && content.headline.trim()) {
            return {
                headline: content.headline
            };
        }
    }
    const asReadySummary = widgetSnapshots.find(function findWeather(snapshot) {
        return snapshot.widgetType === 'weather' && snapshot.status === 'READY';
    });
    if (asReadySummary) {
        const content = asObject(asReadySummary.contentJson);
        if (typeof content.summary === 'string' && content.summary.trim()) {
            return {
                headline: content.summary
            };
        }
    }
    const taskSummary = widgetSnapshots.find(function findTasks(snapshot) {
        return snapshot.widgetType === 'tasks' && snapshot.status === 'READY';
    });
    if (taskSummary) {
        return {
            headline: 'Your latest widget snapshots are ready.'
        };
    }
    const calendarSummary = widgetSnapshots.find(function findCalendar(snapshot) {
        return snapshot.widgetType === 'calendar' && snapshot.status === 'READY';
    });
    if (calendarSummary) {
        return {
            headline: 'Your latest widget snapshots are ready.'
        };
    }
    const xkcdSummary = widgetSnapshots.find(function findXkcd(snapshot) {
        return snapshot.widgetType === 'xkcd' && snapshot.status === 'READY';
    });
    if (xkcdSummary) {
        const content = asObject(xkcdSummary.contentJson);
        if (typeof content.title === 'string' && content.title.trim()) {
            return {
                headline: `Latest xkcd: ${content.title}.`
            };
        }
        return {
            headline: 'Your latest widget snapshots are ready.'
        };
    }
    return {
        headline: widgetSnapshots.some(function hasFailures(snapshot) {
            return snapshot.status === 'FAILED';
        })
            ? 'Some widget snapshots failed to refresh.'
            : 'Snapshot refresh is in progress.'
    };
}
function mapDashboardWidgetRecord(widget) {
    const definition = getWidgetDefinition(widget.widgetType);
    const config = withConnectionConfig(asObject(widget.configJson), widget.connectors);
    return {
        id: widget.id,
        tenantId: widget.tenantId,
        dashboardId: widget.dashboardId,
        ownerUserId: widget.dashboard ? widget.dashboard.ownerUserId : '',
        type: widget.widgetType,
        title: widget.title,
        x: widget.positionX,
        y: widget.positionY,
        width: widget.width,
        height: widget.height,
        minWidth: widget.minWidth,
        minHeight: widget.minHeight,
        isVisible: widget.isVisible,
        sortOrder: widget.sortOrder,
        refreshMode: widget.refreshMode,
        version: widget.version,
        config,
        configHash: widget.configHash || hashWidgetConfig(config),
        data: definition ? definition.createMockData(config) : {},
        connections: (widget.connectors || []).map(mapWidgetConnection),
        createdAt: widget.createdAt,
        updatedAt: widget.updatedAt
    };
}
function mapWidgetConnection(connection) {
    return {
        id: connection.connector.id,
        usageRole: connection.usageRole,
        connector: {
            id: connection.connector.id,
            type: connection.connector.connectorType,
            name: connection.connector.name,
            status: connection.connector.status,
            authType: connection.connector.authType,
            baseUrl: connection.connector.baseUrl,
            config: asObject(connection.connector.configJson),
            lastSyncAt: connection.connector.lastSyncAt,
            createdAt: connection.connector.createdAt,
            updatedAt: connection.connector.updatedAt
        }
    };
}
function mapWidgetSnapshotRecord(snapshot) {
    return {
        widgetId: snapshot.dashboardWidgetId,
        widgetType: snapshot.widgetType,
        title: snapshot.title,
        status: snapshot.status,
        content: asObject(snapshot.contentJson),
        errorMessage: snapshot.errorMessage,
        generatedAt: snapshot.generatedAt
    };
}
function withConnectionConfig(config, connectors) {
    const nextConfig = { ...config };
    applyConnectorConfig(nextConfig, connectors, 'tasks');
    applyConnectorConfig(nextConfig, connectors, 'calendar');
    return nextConfig;
}
function applyConnectorConfig(nextConfig, connectors, usageRole) {
    const connector = (connectors || []).find(function findConnector(item) {
        return item.usageRole === usageRole;
    });
    if (!connector) {
        return;
    }
    nextConfig.connectionId = connector.connector.id;
    nextConfig.connectionName = connector.connector.name;
    nextConfig.provider = connector.connector.connectorType;
}
function asObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return {};
}
