import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { formatSnapshotDateForTimezone } from '../snapshots/snapshot-date.js';
import type { SnapshotJobPublisher } from '../snapshots/snapshot-job-publisher.js';
import { createSnapshotJobPublisherFromEnvironment } from '../snapshots/snapshot-runtime.js';

type AdminWidgetRouteDependencies = {
  prisma: Pick<PrismaClient, 'dashboardWidget'>;
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
  snapshotJobPublisher: Pick<SnapshotJobPublisher, 'publishGenerateWidgetSnapshot'> | null;
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
    const params = request.params as { widgetId?: string };

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
    const published = await dependencies.snapshotJobPublisher.publishGenerateWidgetSnapshot({
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
    });

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
  });
}

function createAdminWidgetRouteDependencies(): AdminWidgetRouteDependencies {
  const prisma = getPrismaClient();

  return {
    prisma,
    defaultUserService: new DefaultUserService(prisma),
    snapshotJobPublisher: createSnapshotJobPublisherFromEnvironment()
  };
}

function mapAdminWidgetRecord(widget: WidgetListRecord) {
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
