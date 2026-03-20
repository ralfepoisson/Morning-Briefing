import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { createSnapshotService } from './snapshot-runtime.js';
import type { SnapshotService } from './snapshot-service.js';

export type SnapshotRouteDependencies = {
  snapshotService: Pick<SnapshotService, 'getLatestForDashboard'>;
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
};

export async function registerSnapshotRoutes(
  app: FastifyInstance,
  dependencies: SnapshotRouteDependencies = createSnapshotRouteDependencies()
): Promise<void> {
  const snapshotService = dependencies.snapshotService;
  const defaultUserService = dependencies.defaultUserService;

  app.get('/api/v1/dashboards/:dashboardId/snapshots/latest', async function handleGetLatestSnapshot(request, reply) {
    const params = request.params as { dashboardId?: string };

    if (!params.dashboardId) {
      reply.code(400);
      return {
        message: 'Dashboard id is required.'
      };
    }

    const user = await defaultUserService.getDefaultUser();
    const snapshot = await snapshotService.getLatestForDashboard(params.dashboardId, user);

    if (!snapshot) {
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
    defaultUserService: new DefaultUserService(prisma)
  };
}
