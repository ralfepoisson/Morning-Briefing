import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { logApplicationEvent, toLogErrorContext } from './application-logger.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { createDashboardBriefingJobPublisherFromEnvironment } from '../dashboard-briefings/dashboard-briefing-runtime.js';
import type { DashboardBriefingJobPublisher } from '../dashboard-briefings/dashboard-briefing-job-publisher.js';

type AdminDashboardRouteDependencies = {
  prisma: Pick<PrismaClient, 'dashboard' | 'dashboardBriefing'>;
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
  dashboardBriefingJobPublisher: Pick<DashboardBriefingJobPublisher, 'publishGenerateDashboardAudioBriefing'> | null;
};

type AdminDashboardListRecord = {
  id: string;
  name: string;
  description: string | null;
  isGenerating: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    displayName: string;
    email: string;
  };
  widgets: Array<{
    id: string;
    widgetType: string;
    title: string;
    isVisible: boolean;
    refreshMode: 'SNAPSHOT' | 'LIVE' | 'HYBRID';
    updatedAt: Date;
  }>;
};

type AdminDashboardBriefingRecord = {
  id: string;
  dashboardId: string;
  status: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
  generatedAt: Date | null;
  estimatedDurationSeconds: number | null;
  errorMessage: string | null;
  audio: Array<{
    id: string;
    durationSeconds: number | null;
    generatedAt: Date | null;
    voiceName: string;
  }>;
};

export async function registerAdminDashboardRoutes(
  app: FastifyInstance,
  dependencies: AdminDashboardRouteDependencies = createAdminDashboardRouteDependencies()
): Promise<void> {
  app.get('/api/v1/admin/dashboards', async function handleListDashboards(request, reply) {
    const user = await dependencies.defaultUserService.getDefaultUser(request);

    if (!user.isAdmin) {
      reply.code(403);
      return {
        message: 'Admin access is required.'
      };
    }

    const dashboards = await listAdminDashboards(dependencies.prisma, user.tenantId);

    const latestBriefings = await listLatestBriefingsForTenant(dependencies.prisma, user.tenantId);
    const items = dashboards.map(function mapDashboard(dashboard) {
      return mapAdminDashboardRecord(dashboard, latestBriefings.get(dashboard.id) || null);
    });

    return {
      items: items
    };
  });

  app.post('/api/v1/admin/dashboards/:dashboardId/regenerate-audio-briefing', async function handleRegenerateAudioBriefing(request, reply) {
    const params = request.params as { dashboardId?: string };

    if (!params.dashboardId) {
      reply.code(400);
      return {
        message: 'Dashboard id is required.'
      };
    }

    if (!dependencies.dashboardBriefingJobPublisher) {
      reply.code(503);
      return {
        message: 'Audio briefing regeneration is currently unavailable.'
      };
    }

    const currentUser = await dependencies.defaultUserService.getDefaultUser(request);

    if (!currentUser.isAdmin) {
      reply.code(403);
      return {
        message: 'Admin access is required.'
      };
    }

    logApplicationEvent({
      level: 'info',
      scope: 'dashboard-briefing',
      event: 'admin_dashboard_briefing_regeneration_requested',
      message: 'Admin requested dashboard audio briefing regeneration.',
      context: {
        dashboardId: params.dashboardId,
        adminUserId: currentUser.userId
      }
    });

    const dashboard = await findDashboardForRegeneration(dependencies.prisma, params.dashboardId, currentUser.tenantId);

    if (!dashboard) {
      reply.code(404);
      return {
        message: 'Dashboard not found.'
      };
    }

    if (dashboard.isGenerating) {
      reply.code(202);
      return {
        status: 'queued',
        alreadyQueued: true,
        job: {
          dashboardId: dashboard.id,
          force: true
        }
      };
    }

    try {
      await setDashboardGeneratingSafe(dependencies.prisma, dashboard.id, true);

      const published = await dependencies.dashboardBriefingJobPublisher.publishGenerateDashboardAudioBriefing({
        dashboardId: dashboard.id,
        tenantId: dashboard.owner.tenantId,
        ownerUserId: dashboard.owner.id,
        ownerDisplayName: dashboard.owner.displayName,
        ownerTimezone: dashboard.owner.timezone,
        ownerLocale: dashboard.owner.locale,
        ownerEmail: dashboard.owner.email,
        ownerIsAdmin: dashboard.owner.isAdmin,
        force: true,
        correlationId: request.id,
        causationId: request.id
      });

      logApplicationEvent({
        level: 'info',
        scope: 'dashboard-briefing',
        event: 'admin_dashboard_briefing_regeneration_queued',
        message: 'Admin dashboard audio briefing regeneration queued.',
        context: {
          dashboardId: dashboard.id,
          adminUserId: currentUser.userId,
          ownerUserId: dashboard.owner.id,
          jobId: published.jobId
        }
      });

      reply.code(202);
      return {
        status: 'queued',
        job: {
          dashboardId: dashboard.id,
          force: true,
          requestedAt: published.requestedAt
        }
      };
    } catch (error) {
      await setDashboardGeneratingSafe(dependencies.prisma, dashboard.id, false);
      logApplicationEvent({
        level: 'error',
        scope: 'dashboard-briefing',
        event: 'admin_dashboard_briefing_regeneration_failed',
        message: error instanceof Error ? error.message : 'Audio briefing regeneration failed.',
        context: {
          dashboardId: params.dashboardId,
          adminUserId: currentUser.userId,
          ...toLogErrorContext(error)
        }
      });
      reply.code(409);
      return {
        message: error instanceof Error ? error.message : 'Audio briefing regeneration failed.'
      };
    }
  });
}

async function listAdminDashboards(
  prisma: Pick<PrismaClient, 'dashboard'>,
  tenantId: string
): Promise<AdminDashboardListRecord[]> {
  try {
    return await prisma.dashboard.findMany({
      where: {
        tenantId,
        archivedAt: null
      },
      select: {
        id: true,
        name: true,
        description: true,
        isGenerating: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        widgets: {
          where: {
            archivedAt: null
          },
          orderBy: [
            { sortOrder: 'asc' },
            { createdAt: 'asc' }
          ],
          select: {
            id: true,
            widgetType: true,
            title: true,
            isVisible: true,
            refreshMode: true,
            updatedAt: true
          }
        }
      },
      orderBy: [
        {
          owner: {
            displayName: 'asc'
          }
        },
        {
          name: 'asc'
        }
      ]
    });
  } catch (error) {
    if (!isMissingDashboardGeneratingSchemaError(error)) {
      throw error;
    }

    const dashboards = await prisma.dashboard.findMany({
      where: {
        tenantId,
        archivedAt: null
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        widgets: {
          where: {
            archivedAt: null
          },
          orderBy: [
            { sortOrder: 'asc' },
            { createdAt: 'asc' }
          ],
          select: {
            id: true,
            widgetType: true,
            title: true,
            isVisible: true,
            refreshMode: true,
            updatedAt: true
          }
        }
      },
      orderBy: [
        {
          owner: {
            displayName: 'asc'
          }
        },
        {
          name: 'asc'
        }
      ]
    });

    return dashboards.map(function mapLegacyDashboard(dashboard) {
      return {
        ...dashboard,
        isGenerating: false
      };
    });
  }
}

async function findDashboardForRegeneration(
  prisma: Pick<PrismaClient, 'dashboard'>,
  dashboardId: string,
  tenantId: string
): Promise<{
  id: string;
  isGenerating: boolean;
  owner: {
    id: string;
    tenantId: string;
    displayName: string;
    timezone: string;
    locale: string;
    email: string;
    isAdmin: boolean;
  };
} | null> {
  try {
    return await prisma.dashboard.findFirst({
      where: {
        id: dashboardId,
        tenantId,
        archivedAt: null
      },
      select: {
        id: true,
        isGenerating: true,
        owner: {
          select: {
            id: true,
            tenantId: true,
            displayName: true,
            timezone: true,
            locale: true,
            email: true,
            isAdmin: true
          }
        }
      }
    });
  } catch (error) {
    if (!isMissingDashboardGeneratingSchemaError(error)) {
      throw error;
    }

    const dashboard = await prisma.dashboard.findFirst({
      where: {
        id: dashboardId,
        tenantId,
        archivedAt: null
      },
      select: {
        id: true,
        owner: {
          select: {
            id: true,
            tenantId: true,
            displayName: true,
            timezone: true,
            locale: true,
            email: true,
            isAdmin: true
          }
        }
      }
    });

    if (!dashboard) {
      return null;
    }

    return {
      ...dashboard,
      isGenerating: false
    };
  }
}

async function setDashboardGeneratingSafe(
  prisma: Pick<PrismaClient, 'dashboard'>,
  dashboardId: string,
  isGenerating: boolean
): Promise<void> {
  try {
    await prisma.dashboard.update({
      where: {
        id: dashboardId
      },
      data: {
        isGenerating
      }
    });
  } catch (error) {
    if (!isMissingDashboardGeneratingSchemaError(error)) {
      throw error;
    }
  }
}

function createAdminDashboardRouteDependencies(): AdminDashboardRouteDependencies {
  const prisma = getPrismaClient();

  return {
    prisma: prisma,
    defaultUserService: new DefaultUserService(prisma),
    dashboardBriefingJobPublisher: createDashboardBriefingJobPublisherFromEnvironment()
  };
}

async function listLatestBriefingsForTenant(
  prisma: Pick<PrismaClient, 'dashboardBriefing'>,
  tenantId: string
): Promise<Map<string, AdminDashboardBriefingRecord>> {
  try {
    const briefings = await prisma.dashboardBriefing.findMany({
      where: {
        dashboard: {
          tenantId,
          archivedAt: null
        }
      },
      select: {
        id: true,
        dashboardId: true,
        status: true,
        generatedAt: true,
        estimatedDurationSeconds: true,
        errorMessage: true,
        audio: {
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' }
          ],
          take: 1,
          select: {
            id: true,
            durationSeconds: true,
            generatedAt: true,
            voiceName: true
          }
        }
      },
      orderBy: [
        { dashboardId: 'asc' },
        { createdAt: 'desc' },
        { id: 'desc' }
      ]
    });

    return briefings.reduce(function reduceBriefings(map, briefing) {
      if (!map.has(briefing.dashboardId)) {
        map.set(briefing.dashboardId, briefing as AdminDashboardBriefingRecord);
      }

      return map;
    }, new Map<string, AdminDashboardBriefingRecord>());
  } catch (error) {
    if (!isMissingBriefingSchemaError(error)) {
      throw error;
    }

    return new Map<string, AdminDashboardBriefingRecord>();
  }
}

function mapAdminDashboardRecord(dashboard: AdminDashboardListRecord, briefing: AdminDashboardBriefingRecord | null) {
  const latestAudio = briefing && briefing.audio.length ? briefing.audio[0] : null;

  return {
    id: dashboard.id,
    name: dashboard.name,
    description: dashboard.description || '',
    isGenerating: dashboard.isGenerating,
    createdAt: dashboard.createdAt.toISOString(),
    updatedAt: dashboard.updatedAt.toISOString(),
    owner: {
      id: dashboard.owner.id,
      displayName: dashboard.owner.displayName,
      email: dashboard.owner.email
    },
    widgetCount: dashboard.widgets.length,
    widgets: dashboard.widgets.map(function mapWidget(widget) {
      return {
        id: widget.id,
        type: widget.widgetType,
        title: widget.title,
        isVisible: widget.isVisible,
        refreshMode: widget.refreshMode,
        updatedAt: widget.updatedAt.toISOString()
      };
    }),
    audioBriefing: briefing
      ? {
        id: briefing.id,
        status: briefing.status,
        generatedAt: briefing.generatedAt ? briefing.generatedAt.toISOString() : null,
        estimatedDurationSeconds: briefing.estimatedDurationSeconds,
        errorMessage: briefing.errorMessage,
        audio: latestAudio
          ? {
            id: latestAudio.id,
            durationSeconds: latestAudio.durationSeconds,
            generatedAt: latestAudio.generatedAt ? latestAudio.generatedAt.toISOString() : null,
            voiceName: latestAudio.voiceName
          }
          : null
      }
      : null
  };
}

function isMissingDashboardGeneratingSchemaError(error: unknown): boolean {
  return error instanceof Error &&
    error.message.includes('dashboards.is_generating');
}

function isMissingBriefingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
  };
  const message = typeof candidate.message === 'string' ? candidate.message : '';

  return candidate.code === 'P2021'
    || candidate.code === 'P2022'
    || message.includes('dashboard_briefing')
    || message.includes('dashboard_briefings')
    || message.includes('dashboard_briefing_audio');
}
