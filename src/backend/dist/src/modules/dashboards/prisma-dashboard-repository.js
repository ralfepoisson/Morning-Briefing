export class PrismaDashboardRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listForOwner(ownerUserId) {
        try {
            const dashboards = await this.prisma.dashboard.findMany({
                where: {
                    ownerUserId,
                    archivedAt: null
                },
                orderBy: [
                    { isDefault: 'desc' },
                    { createdAt: 'asc' }
                ],
                select: {
                    id: true,
                    ownerUserId: true,
                    name: true,
                    description: true,
                    themeJson: true,
                    isGenerating: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            return dashboards.map(mapDashboardRecord);
        }
        catch (error) {
            if (!isMissingDashboardGeneratingSchemaError(error)) {
                throw error;
            }
            const dashboards = await this.prisma.dashboard.findMany({
                where: {
                    ownerUserId,
                    archivedAt: null
                },
                orderBy: [
                    { isDefault: 'desc' },
                    { createdAt: 'asc' }
                ],
                select: {
                    id: true,
                    ownerUserId: true,
                    name: true,
                    description: true,
                    themeJson: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            return dashboards.map(function mapLegacyDashboard(dashboard) {
                return mapDashboardRecord({
                    ...dashboard,
                    isGenerating: false
                });
            });
        }
    }
    async create(input) {
        const owner = await this.prisma.appUser.findUniqueOrThrow({
            where: {
                id: input.ownerUserId
            }
        });
        const dashboard = await this.prisma.dashboard.create({
            data: {
                tenantId: owner.tenantId,
                ownerUserId: input.ownerUserId,
                name: input.name,
                description: input.description || '',
                themeJson: {
                    key: input.theme || 'aurora'
                }
            }
        });
        return mapDashboardRecord(dashboard);
    }
    async update(input) {
        const dashboard = await this.prisma.dashboard.findFirst({
            where: {
                id: input.dashboardId,
                ownerUserId: input.ownerUserId,
                archivedAt: null
            }
        });
        if (!dashboard) {
            return null;
        }
        const updatedDashboard = await this.prisma.dashboard.update({
            where: {
                id: dashboard.id
            },
            data: {
                name: input.name,
                description: input.description || '',
                version: {
                    increment: 1
                }
            }
        });
        return mapDashboardRecord(updatedDashboard);
    }
    async archive(input) {
        const dashboard = await this.prisma.dashboard.findFirst({
            where: {
                id: input.dashboardId,
                ownerUserId: input.ownerUserId,
                archivedAt: null
            }
        });
        if (!dashboard) {
            return false;
        }
        const archivedAt = new Date();
        await this.prisma.$transaction([
            this.prisma.dashboard.update({
                where: {
                    id: dashboard.id
                },
                data: {
                    archivedAt,
                    isActive: false,
                    version: {
                        increment: 1
                    }
                }
            }),
            this.prisma.dashboardWidget.updateMany({
                where: {
                    dashboardId: dashboard.id,
                    archivedAt: null
                },
                data: {
                    archivedAt,
                    isVisible: false,
                    version: {
                        increment: 1
                    }
                }
            })
        ]);
        return true;
    }
}
function mapDashboardRecord(dashboard) {
    return {
        id: dashboard.id,
        ownerUserId: dashboard.ownerUserId,
        name: dashboard.name,
        description: dashboard.description || '',
        theme: getThemeKey(dashboard.themeJson),
        isGenerating: 'isGenerating' in dashboard ? Boolean(dashboard.isGenerating) : false,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt
    };
}
function getThemeKey(themeJson) {
    if (themeJson && typeof themeJson === 'object' && 'key' in themeJson) {
        const key = themeJson.key;
        if (typeof key === 'string' && key.trim()) {
            return key;
        }
    }
    return 'aurora';
}
function isMissingDashboardGeneratingSchemaError(error) {
    return error instanceof Error &&
        error.message.includes('dashboards.is_generating');
}
