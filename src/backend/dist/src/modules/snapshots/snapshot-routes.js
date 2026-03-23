import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { createSnapshotService } from './snapshot-runtime.js';
export async function registerSnapshotRoutes(app, dependencies = createSnapshotRouteDependencies()) {
    const snapshotService = dependencies.snapshotService;
    const defaultUserService = dependencies.defaultUserService;
    app.get('/api/v1/dashboards/:dashboardId/snapshots/latest', async function handleGetLatestSnapshot(request, reply) {
        const params = request.params;
        if (!params.dashboardId) {
            reply.code(400);
            return {
                message: 'Dashboard id is required.'
            };
        }
        const user = await defaultUserService.getDefaultUser(request);
        const snapshot = await snapshotService.getPersistedLatestForDashboard(params.dashboardId, user);
        if (!snapshot) {
            reply.code(404);
            return {
                message: 'Dashboard not found.'
            };
        }
        return snapshot;
    });
}
function createSnapshotRouteDependencies() {
    const prisma = getPrismaClient();
    return {
        snapshotService: createSnapshotService(),
        defaultUserService: new DefaultUserService(prisma)
    };
}
