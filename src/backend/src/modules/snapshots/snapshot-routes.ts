import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { PrismaDashboardRepository } from '../dashboards/prisma-dashboard-repository.js';
import { DashboardService } from '../dashboards/dashboard-service.js';
import { createSnapshotService } from './snapshot-runtime.js';
import type { SnapshotService } from './snapshot-service.js';

export type SnapshotRouteDependencies = {
  snapshotService: Pick<SnapshotService, 'getPersistedLatestForDashboard'>;
  dashboardService: Pick<DashboardService, 'listForOwner'>;
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
};

export async function registerSnapshotRoutes(
  app: FastifyInstance,
  dependencies: SnapshotRouteDependencies = createSnapshotRouteDependencies()
): Promise<void> {
  const snapshotService = dependencies.snapshotService;
  const dashboardService = dependencies.dashboardService;
  const defaultUserService = dependencies.defaultUserService;

  app.get('/api/v1/dashboards/:dashboardId/snapshots/latest', async function handleGetLatestSnapshot(request, reply) {
    const params = request.params as { dashboardId?: string };

    if (!params.dashboardId) {
      reply.code(400);
      return {
        message: 'Dashboard id is required.'
      };
    }

    const user = await defaultUserService.getDefaultUser(request);
    const snapshot = await snapshotService.getPersistedLatestForDashboard(params.dashboardId, user);

    if (!snapshot) {
      const dashboards = await dashboardService.listForOwner(user.userId);
      const dashboardExists = dashboards.some(function findDashboard(dashboard) {
        return dashboard.id === params.dashboardId;
      });

      if (dashboardExists) {
        return null;
      }

      reply.code(404);
      return {
        message: 'Dashboard not found.'
      };
    }

    return snapshot;
  });
}

function createSnapshotRouteDependencies(): SnapshotRouteDependencies {
  const prisma = getPrismaClient();

  return {
    snapshotService: createSnapshotService(),
    dashboardService: new DashboardService(new PrismaDashboardRepository(prisma)),
    defaultUserService: new DefaultUserService(prisma)
  };
}
