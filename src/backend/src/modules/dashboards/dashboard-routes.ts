import type { FastifyInstance } from 'fastify';
import { DashboardService } from './dashboard-service.js';
import { PrismaDashboardRepository } from './prisma-dashboard-repository.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';

export type DashboardRouteDependencies = {
  dashboardService: Pick<DashboardService, 'listForOwner' | 'create' | 'update' | 'archive'>;
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
};

export async function registerDashboardRoutes(
  app: FastifyInstance,
  dependencies: DashboardRouteDependencies = createDashboardRouteDependencies()
): Promise<void> {
  const service = dependencies.dashboardService;
  const defaultUserService = dependencies.defaultUserService;

  app.get('/api/v1/me', async function handleGetMe(request) {
    const user = await defaultUserService.getDefaultUser(request);

    return {
      id: user.userId,
      displayName: user.displayName
    };
  });

  app.get('/api/v1/dashboards', async function handleListDashboards(request) {
    const user = await defaultUserService.getDefaultUser(request);
    const dashboards = await service.listForOwner(user.userId);

    return {
      items: dashboards
    };
  });

  app.post('/api/v1/dashboards', async function handleCreateDashboard(request, reply) {
    const body = request.body as {
      name?: string;
      description?: string;
      theme?: string;
    };

    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      reply.code(400);
      return {
        message: 'Dashboard name is required.'
      };
    }

    const user = await defaultUserService.getDefaultUser(request);
    const dashboard = await service.create({
      ownerUserId: user.userId,
      name: body.name,
      description: body.description,
      theme: body.theme
    });

    reply.code(201);
    return dashboard;
  });

  app.patch('/api/v1/dashboards/:dashboardId', async function handleUpdateDashboard(request, reply) {
    const params = request.params as { dashboardId?: string };
    const body = request.body as {
      name?: string;
      description?: string;
    };

    if (!params.dashboardId) {
      reply.code(400);
      return {
        message: 'Dashboard id is required.'
      };
    }

    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      reply.code(400);
      return {
        message: 'Dashboard name is required.'
      };
    }

    const user = await defaultUserService.getDefaultUser(request);
    const dashboard = await service.update({
      dashboardId: params.dashboardId,
      ownerUserId: user.userId,
      name: body.name,
      description: body.description
    });

    if (!dashboard) {
      reply.code(404);
      return {
        message: 'Dashboard not found.'
      };
    }

    return dashboard;
  });

  app.delete('/api/v1/dashboards/:dashboardId', async function handleArchiveDashboard(request, reply) {
    const params = request.params as { dashboardId?: string };

    if (!params.dashboardId) {
      reply.code(400);
      return {
        message: 'Dashboard id is required.'
      };
    }

    const user = await defaultUserService.getDefaultUser(request);
    const archived = await service.archive({
      dashboardId: params.dashboardId,
      ownerUserId: user.userId
    });

    if (!archived) {
      reply.code(404);
      return {
        message: 'Dashboard not found.'
      };
    }

    reply.code(204);
    return null;
  });
}

function createDashboardRouteDependencies(): DashboardRouteDependencies {
  const prisma = getPrismaClient();

  return {
    dashboardService: new DashboardService(new PrismaDashboardRepository(prisma)),
    defaultUserService: new DefaultUserService(prisma)
  };
}
