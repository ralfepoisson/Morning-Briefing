import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { logApplicationEvent } from './application-logger.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { createDashboardBriefingService } from '../dashboard-briefings/dashboard-briefing-runtime.js';
export async function registerAdminDashboardRoutes(app, dependencies = createAdminDashboardRouteDependencies()) {
    app.get('/api/v1/admin/dashboards', async function handleListDashboards(request, reply) {
        const user = await dependencies.defaultUserService.getDefaultUser(request);
        if (!user.isAdmin) {
            reply.code(403);
            return {
                message: 'Admin access is required.'
            };
        }
        const dashboards = await dependencies.prisma.dashboard.findMany({
            where: {
                tenantId: user.tenantId,
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
        const latestBriefings = await listLatestBriefingsForTenant(dependencies.prisma, user.tenantId);
        const items = dashboards.map(function mapDashboard(dashboard) {
            return mapAdminDashboardRecord(dashboard, latestBriefings.get(dashboard.id) || null);
        });
        return {
            items: items
        };
    });
    app.post('/api/v1/admin/dashboards/:dashboardId/regenerate-audio-briefing', async function handleRegenerateAudioBriefing(request, reply) {
        const params = request.params;
        if (!params.dashboardId) {
            reply.code(400);
            return {
                message: 'Dashboard id is required.'
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
        const dashboard = await dependencies.prisma.dashboard.findFirst({
            where: {
                id: params.dashboardId,
                tenantId: currentUser.tenantId,
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
            reply.code(404);
            return {
                message: 'Dashboard not found.'
            };
        }
        try {
            const result = await dependencies.dashboardBriefingService.generateBriefing(dashboard.id, {
                tenantId: dashboard.owner.tenantId,
                userId: dashboard.owner.id,
                displayName: dashboard.owner.displayName,
                timezone: dashboard.owner.timezone,
                locale: dashboard.owner.locale,
                email: dashboard.owner.email,
                isAdmin: dashboard.owner.isAdmin
            }, {
                force: true
            });
            if (!result) {
                reply.code(404);
                return {
                    message: 'Dashboard not found.'
                };
            }
            return result;
        }
        catch (error) {
            reply.code(409);
            return {
                message: error instanceof Error ? error.message : 'Audio briefing regeneration failed.'
            };
        }
    });
}
function createAdminDashboardRouteDependencies() {
    const prisma = getPrismaClient();
    return {
        prisma: prisma,
        defaultUserService: new DefaultUserService(prisma),
        dashboardBriefingService: createDashboardBriefingService()
    };
}
async function listLatestBriefingsForTenant(prisma, tenantId) {
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
                map.set(briefing.dashboardId, briefing);
            }
            return map;
        }, new Map());
    }
    catch (error) {
        if (!isMissingBriefingSchemaError(error)) {
            throw error;
        }
        return new Map();
    }
}
function mapAdminDashboardRecord(dashboard, briefing) {
    const latestAudio = briefing && briefing.audio.length ? briefing.audio[0] : null;
    return {
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description || '',
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
function isMissingBriefingSchemaError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const candidate = error;
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    return candidate.code === 'P2021'
        || candidate.code === 'P2022'
        || message.includes('dashboard_briefing')
        || message.includes('dashboard_briefings')
        || message.includes('dashboard_briefing_audio');
}
