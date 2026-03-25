import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { formatSnapshotDateForTimezone } from '../snapshots/snapshot-date.js';
import type { SnapshotJobPublisher } from '../snapshots/snapshot-job-publisher.js';
import { buildSnapshotJobIdempotencyKey } from '../snapshots/snapshot-job-utils.js';
import { createSnapshotJobPublisherFromEnvironment, createSnapshotService } from '../snapshots/snapshot-runtime.js';
import type { SnapshotService } from '../snapshots/snapshot-service.js';

type AdminWidgetRouteDependencies = {
  prisma: Pick<PrismaClient, 'dashboardWidget'>;
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
  snapshotJobPublisher: Pick<SnapshotJobPublisher, 'publishGenerateWidgetSnapshot'> | null;
  snapshotService: Pick<SnapshotService, 'generateForWidget'>;
};

type WidgetListRecord = {
  id: string;
  dashboardId: string;
  widgetType: string;
  title: string;
  isVisible: boolean;
  refreshMode: 'SNAPSHOT' | 'LIVE' | 'HYBRID';
  version: number;
  configHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  dashboard: {
    id: string;
    name: string;
    ownerUserId: string;
  };
  snapshots?: Array<{
    status: 'PENDING' | 'READY' | 'FAILED';
    errorMessage: string | null;
    contentJson: unknown;
    generatedAt: Date;
    snapshot: {
      snapshotDate: Date;
    };
  }>;
  snapshotJobs?: Array<{
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    triggerSource: string;
    duplicateSkipCount: number;
    lastDuplicateAt: Date | null;
    createdAt: Date;
  }>;
};

type WidgetRefreshRecord = {
  id: string;
  tenantId: string;
  dashboardId: string;
  widgetType: string;
  title: string;
  refreshMode: 'SNAPSHOT' | 'LIVE' | 'HYBRID';
  version: number;
  configHash: string | null;
  dashboard: {
    id: string;
    ownerUserId: string;
  };
};

export async function registerAdminWidgetRoutes(
  app: FastifyInstance,
  dependencies: AdminWidgetRouteDependencies = createAdminWidgetRouteDependencies()
): Promise<void> {
  app.get('/api/v1/admin/widgets', async function handleListWidgets(request, reply) {
    const user = await dependencies.defaultUserService.getDefaultUser(request);

    if (!user.isAdmin) {
      reply.code(403);
      return {
        message: 'Admin access is required.'
      };
    }

    const widgets = await dependencies.prisma.dashboardWidget.findMany({
      where: {
        tenantId: user.tenantId,
        archivedAt: null,
        dashboard: {
          archivedAt: null
        }
      },
      select: {
        id: true,
        dashboardId: true,
        widgetType: true,
        title: true,
        isVisible: true,
        refreshMode: true,
        version: true,
        configHash: true,
        createdAt: true,
        updatedAt: true,
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
        },
        snapshotJobs: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 20
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
    const params = request.params as { widgetId?: string };
    const body = request.body as { bypassDuplicateCheck?: boolean } | undefined;

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

    const user = await dependencies.defaultUserService.getDefaultUser(request);

    if (!user.isAdmin) {
      reply.code(403);
      return {
        message: 'Admin access is required.'
      };
    }

    const widget = await dependencies.prisma.dashboardWidget.findFirst({
      where: {
        id: params.widgetId,
        tenantId: user.tenantId,
        archivedAt: null,
        dashboard: {
          archivedAt: null
        }
      },
      select: {
        id: true,
        tenantId: true,
        dashboardId: true,
        widgetType: true,
        title: true,
        refreshMode: true,
        version: true,
        configHash: true,
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
    const requestedAt = new Date();
    const bypassDuplicateCheck = body?.bypassDuplicateCheck === true;
    const jobInput = {
      widgetId: widget.id,
      dashboardId: widget.dashboardId,
      tenantId: widget.tenantId,
      userId: user.userId,
      widgetConfigVersion: widget.version,
      widgetConfigHash: widget.configHash,
      snapshotDate,
      triggerSource: 'manual_refresh' as const,
      bypassDuplicateCheck,
      correlationId: request.id,
      causationId: request.id,
      requestedAt
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
          bypassDuplicateCheck: published.bypassDuplicateCheck,
          requestedAt: published.requestedAt
        }
      };
    } catch (error) {
      await dependencies.snapshotService.generateForWidget({
        schemaVersion: 1,
        jobId: 'manual-refresh-' + widget.id + '-' + snapshotDate,
        idempotencyKey: buildSnapshotJobIdempotencyKey({
          widgetId: widget.id,
          snapshotDate,
          widgetConfigHash: widget.configHash,
          triggerSource: 'manual_refresh',
          requestedAt,
          bypassDuplicateCheck
        }),
        widgetId: widget.id,
        dashboardId: widget.dashboardId,
        tenantId: widget.tenantId,
        userId: user.userId,
        widgetConfigVersion: widget.version,
        widgetConfigHash: widget.configHash,
        snapshotDate,
        snapshotPeriod: 'day',
        triggerSource: 'manual_refresh',
        bypassDuplicateCheck,
        correlationId: request.id,
        causationId: request.id,
        requestedAt: requestedAt.toISOString()
      });

      reply.code(200);
      return {
        status: 'generated',
        mode: 'direct',
        message: error instanceof Error ? error.message : 'Snapshot queue unavailable. Generated directly instead.',
        job: {
          widgetId: widget.id,
          snapshotDate,
          triggerSource: 'manual_refresh',
          bypassDuplicateCheck
        }
      };
    }
  });
}

function createAdminWidgetRouteDependencies(): AdminWidgetRouteDependencies {
  const prisma = getPrismaClient();

  return {
    prisma,
    defaultUserService: new DefaultUserService(prisma),
    snapshotJobPublisher: createSnapshotJobPublisherFromEnvironment(),
    snapshotService: createSnapshotService()
  };
}

function mapAdminWidgetRecord(widget: WidgetListRecord) {
  const latestSnapshot = widget.snapshots && widget.snapshots.length ? widget.snapshots[0] : null;
  const duplicateSkipCount = (widget.snapshotJobs || []).reduce(function countDuplicates(total, job) {
    return total + (job.duplicateSkipCount || 0);
  }, 0);
  const latestDuplicateAt = (widget.snapshotJobs || []).reduce<Date | null>(function findLatest(current, job) {
    if (!job.lastDuplicateAt) {
      return current;
    }

    if (!current || job.lastDuplicateAt.getTime() > current.getTime()) {
      return job.lastDuplicateAt;
    }

    return current;
  }, null);

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
    duplicateSkipCount,
    latestDuplicateAt: latestDuplicateAt ? latestDuplicateAt.toISOString() : null,
    isFailing: !!(latestSnapshot && latestSnapshot.status === 'FAILED'),
    createdAt: widget.createdAt.toISOString(),
    updatedAt: widget.updatedAt.toISOString()
  };
}
