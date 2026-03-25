import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { createDashboardBriefingService } from './dashboard-briefing-runtime.js';
export async function registerDashboardBriefingRoutes(app, dependencies = createDashboardBriefingRouteDependencies()) {
    const service = dependencies.dashboardBriefingService;
    const defaultUserService = dependencies.defaultUserService;
    app.get('/api/v1/dashboards/:dashboardId/audio-briefing/preferences', async function handleGetPreferences(request, reply) {
        const params = request.params;
        if (!params.dashboardId) {
            reply.code(400);
            return { message: 'Dashboard id is required.' };
        }
        const user = await defaultUserService.getDefaultUser(request);
        const preferences = await service.getPreferences(params.dashboardId, user);
        if (!preferences) {
            reply.code(404);
            return { message: 'Dashboard not found.' };
        }
        return preferences;
    });
    app.patch('/api/v1/dashboards/:dashboardId/audio-briefing/preferences', async function handleUpdatePreferences(request, reply) {
        const params = request.params;
        const body = request.body;
        if (!params.dashboardId) {
            reply.code(400);
            return { message: 'Dashboard id is required.' };
        }
        const user = await defaultUserService.getDefaultUser(request);
        const preferences = await service.updatePreferences(params.dashboardId, user, body || {});
        if (!preferences) {
            reply.code(404);
            return { message: 'Dashboard not found.' };
        }
        return preferences;
    });
    app.get('/api/v1/dashboards/:dashboardId/audio-briefing/input-preview', async function handlePreviewInput(request, reply) {
        const params = request.params;
        if (!params.dashboardId) {
            reply.code(400);
            return { message: 'Dashboard id is required.' };
        }
        const user = await defaultUserService.getDefaultUser(request);
        const preview = await service.previewInput(params.dashboardId, user);
        if (!preview) {
            reply.code(404);
            return { message: 'Dashboard not found.' };
        }
        return preview;
    });
    app.get('/api/v1/dashboards/:dashboardId/audio-briefing', async function handleGetLatestBriefing(request, reply) {
        const params = request.params;
        if (!params.dashboardId) {
            reply.code(400);
            return { message: 'Dashboard id is required.' };
        }
        const user = await defaultUserService.getDefaultUser(request);
        const briefing = await service.getLatestBriefing(params.dashboardId, user);
        if (briefing === null) {
            reply.code(404);
            return { message: 'Dashboard not found.' };
        }
        return typeof briefing === 'undefined' ? null : briefing;
    });
    app.post('/api/v1/dashboards/:dashboardId/audio-briefing/generate', async function handleGenerateBriefing(request, reply) {
        const params = request.params;
        const body = request.body;
        if (!params.dashboardId) {
            reply.code(400);
            return { message: 'Dashboard id is required.' };
        }
        const user = await defaultUserService.getDefaultUser(request);
        try {
            const result = await service.generateBriefing(params.dashboardId, user, {
                force: !!(body && body.force)
            });
            if (!result) {
                reply.code(404);
                return { message: 'Dashboard not found.' };
            }
            return result;
        }
        catch (error) {
            reply.code(409);
            return {
                message: error instanceof Error ? error.message : 'Dashboard briefing generation failed.'
            };
        }
    });
    app.get('/api/v1/dashboard-briefing-audio/:audioId', async function handleGetAudioMetadata(request, reply) {
        const params = request.params;
        if (!params.audioId) {
            reply.code(400);
            return { message: 'Audio id is required.' };
        }
        const user = await defaultUserService.getDefaultUser(request);
        const audio = await service.getAudioMetadata(params.audioId, user);
        if (!audio) {
            reply.code(404);
            return { message: 'Audio briefing not found.' };
        }
        return audio;
    });
    app.get('/api/v1/dashboard-briefing-audio/:audioId/content', async function handleGetAudioContent(request, reply) {
        const params = request.params;
        if (!params.audioId) {
            reply.code(400);
            return { message: 'Audio id is required.' };
        }
        const user = await defaultUserService.getDefaultUser(request);
        try {
            const audio = await service.getAudioContent(params.audioId, user);
            if (!audio) {
                reply.code(404);
                return { message: 'Audio briefing not found.' };
            }
            reply.type(audio.mimeType);
            return reply.send(audio.content);
        }
        catch (error) {
            reply.code(404);
            return {
                message: error instanceof Error ? error.message : 'Audio file is missing.'
            };
        }
    });
}
function createDashboardBriefingRouteDependencies() {
    const prisma = getPrismaClient();
    return {
        dashboardBriefingService: createDashboardBriefingService(),
        defaultUserService: new DefaultUserService(prisma)
    };
}
