import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { formatSnapshotDateForTimezone } from '../snapshots/snapshot-date.js';
import { createSnapshotJobPublisherFromEnvironment, createSnapshotService } from '../snapshots/snapshot-runtime.js';
export async function registerAdminWidgetRoutes(app, dependencies = createAdminWidgetRouteDependencies()) {
    app.get('/api/v1/admin/widgets', async function handleListWidgets() {
        const user = await dependencies.defaultUserService.getDefaultUser();
        const widgets = await dependencies.prisma.dashboardWidget.findMany({
            where: {
                archivedAt: null,
                dashboard: {
                    ownerUserId: user.userId,
                    archivedAt: null
                }
            },
            include: {
                dashboard: {
                    select: {
                        id: true,
                        name: true,
                        ownerUserId: true
                    }
                },
                snapshots: {
                    include: {
                        snapshot: {
                            select: {
                                snapshotDate: true
                            }
                        }
                    },
                    orderBy: {
                        generatedAt: 'desc'
                    },
                    take: 1
                }
            },
            orderBy: [
                {
                    dashboard: {
                        name: 'asc'
                    }
                },
                {
                    sortOrder: 'asc'
                },
                {
                    createdAt: 'asc'
                }
            ]
        });
        return {
            items: widgets.map(mapAdminWidgetRecord)
        };
    });
    app.post('/api/v1/admin/widgets/:widgetId/regenerate-snapshot', async function handleRegenerateWidgetSnapshot(request, reply) {
        const params = request.params;
        if (!params.widgetId) {
            reply.code(400);
            return {
                message: 'Widget id is required.'
            };
        }
        if (!dependencies.snapshotJobPublisher) {
            reply.code(503);
            return {
                message: 'Snapshot regeneration is currently unavailable.'
            };
        }
        const user = await dependencies.defaultUserService.getDefaultUser();
        const widget = await dependencies.prisma.dashboardWidget.findFirst({
            where: {
                id: params.widgetId,
                archivedAt: null,
                dashboard: {
                    ownerUserId: user.userId,
                    archivedAt: null
                }
            },
            include: {
                dashboard: {
                    select: {
                        id: true,
                        ownerUserId: true
                    }
                }
            }
        });
        if (!widget) {
            reply.code(404);
            return {
                message: 'Widget not found.'
            };
        }
        if (!widget.configHash) {
            reply.code(409);
            return {
                message: 'Widget snapshot metadata is incomplete.'
            };
        }
        if (widget.refreshMode === 'LIVE') {
            reply.code(400);
            return {
                message: 'This widget does not support snapshot regeneration.'
            };
        }
        const snapshotDate = formatSnapshotDateForTimezone(new Date(), user.timezone || 'UTC');
        const jobInput = {
            widgetId: widget.id,
            dashboardId: widget.dashboardId,
            tenantId: widget.tenantId,
            userId: user.userId,
            widgetConfigVersion: widget.version,
            widgetConfigHash: widget.configHash,
            snapshotDate,
            triggerSource: 'manual_refresh',
            correlationId: request.id,
            causationId: request.id
        };
        try {
            const published = await dependencies.snapshotJobPublisher.publishGenerateWidgetSnapshot(jobInput);
            reply.code(202);
            return {
                status: 'queued',
                job: {
                    widgetId: widget.id,
                    snapshotDate: published.snapshotDate,
                    triggerSource: published.triggerSource,
                    requestedAt: published.requestedAt
                }
            };
        }
        catch (error) {
            await dependencies.snapshotService.generateForWidget({
                schemaVersion: 1,
                jobId: 'manual-refresh-' + widget.id + '-' + snapshotDate,
                idempotencyKey: widget.id + ':' + snapshotDate + ':' + widget.configHash,
                widgetId: widget.id,
                dashboardId: widget.dashboardId,
                tenantId: widget.tenantId,
                userId: user.userId,
                widgetConfigVersion: widget.version,
                widgetConfigHash: widget.configHash,
                snapshotDate,
                snapshotPeriod: 'day',
                triggerSource: 'manual_refresh',
                correlationId: request.id,
                causationId: request.id,
                requestedAt: new Date().toISOString()
            });
            reply.code(200);
            return {
                status: 'generated',
                mode: 'direct',
                message: error instanceof Error ? error.message : 'Snapshot queue unavailable. Generated directly instead.',
                job: {
                    widgetId: widget.id,
                    snapshotDate,
                    triggerSource: 'manual_refresh'
                }
            };
        }
    });
}
function createAdminWidgetRouteDependencies() {
    const prisma = getPrismaClient();
    return {
        prisma,
        defaultUserService: new DefaultUserService(prisma),
        snapshotJobPublisher: createSnapshotJobPublisherFromEnvironment(),
        snapshotService: createSnapshotService()
    };
}
function mapAdminWidgetRecord(widget) {
    const latestSnapshot = widget.snapshots && widget.snapshots.length ? widget.snapshots[0] : null;
    return {
        id: widget.id,
        dashboardId: widget.dashboardId,
        dashboardName: widget.dashboard.name,
        type: widget.widgetType,
        title: widget.title,
        isVisible: widget.isVisible,
        refreshMode: widget.refreshMode,
        latestSnapshotAt: latestSnapshot ? latestSnapshot.generatedAt.toISOString() : null,
        latestSnapshotDate: latestSnapshot ? latestSnapshot.snapshot.snapshotDate.toISOString().slice(0, 10) : null,
        latestSnapshotStatus: latestSnapshot ? latestSnapshot.status : null,
        latestErrorMessage: latestSnapshot ? latestSnapshot.errorMessage : null,
        latestSnapshotContent: latestSnapshot ? latestSnapshot.contentJson ?? null : null,
        isFailing: !!(latestSnapshot && latestSnapshot.status === 'FAILED'),
        createdAt: widget.createdAt.toISOString(),
        updatedAt: widget.updatedAt.toISOString()
    };
}
