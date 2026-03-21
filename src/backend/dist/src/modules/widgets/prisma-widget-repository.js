import { getWidgetDefinition } from './widget-definitions.js';
import { hashWidgetConfig } from '../snapshots/snapshot-job-utils.js';
export class PrismaWidgetRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listForDashboard(dashboardId, ownerUserId) {
        const widgets = await this.prisma.dashboardWidget.findMany({
            where: {
                dashboardId,
                archivedAt: null,
                dashboard: {
                    ownerUserId,
                    archivedAt: null
                }
            },
            include: {
                connectors: {
                    include: {
                        connector: true
                    }
                }
            },
            orderBy: [
                { sortOrder: 'asc' },
                { createdAt: 'asc' }
            ]
        });
        return widgets.map(mapDashboardWidgetRecord);
    }
    async create(input) {
        const definition = getWidgetDefinition(input.type);
        if (!definition) {
            throw new Error('Widget type is not supported.');
        }
        const dashboard = await this.prisma.dashboard.findFirst({
            where: {
                id: input.dashboardId,
                ownerUserId: input.ownerUserId,
                archivedAt: null
            },
            include: {
                widgets: {
                    orderBy: {
                        sortOrder: 'desc'
                    },
                    take: 1
                }
            }
        });
        if (!dashboard) {
            throw new Error('Dashboard not found.');
        }
        const nextSortOrder = dashboard.widgets.length ? dashboard.widgets[0].sortOrder + 1 : 1;
        const nextOffset = nextSortOrder - 1;
        const defaultConfig = definition.createDefaultConfig();
        const widget = await this.prisma.dashboardWidget.create({
            data: {
                tenantId: dashboard.tenantId,
                dashboardId: dashboard.id,
                widgetType: definition.type,
                title: definition.title,
                positionX: 36 + nextOffset * 28,
                positionY: 36 + nextOffset * 28,
                width: definition.defaultSize.width,
                height: definition.defaultSize.height,
                minWidth: definition.minSize.width,
                minHeight: definition.minSize.height,
                refreshMode: definition.refreshMode,
                sortOrder: nextSortOrder,
                configJson: defaultConfig,
                configHash: hashWidgetConfig(defaultConfig)
            }
        });
        return mapDashboardWidgetRecord(widget);
    }
    async update(input) {
        const widget = await this.prisma.dashboardWidget.findFirst({
            where: {
                id: input.widgetId,
                dashboardId: input.dashboardId,
                archivedAt: null,
                dashboard: {
                    ownerUserId: input.ownerUserId,
                    archivedAt: null
                }
            }
        });
        if (!widget) {
            return null;
        }
        const normalizedConfig = normalizeWidgetConfig(input.config || asObject(widget.configJson));
        const nextConfigHash = hashWidgetConfig(normalizedConfig);
        const currentConfigHash = widget.configHash || hashWidgetConfig(asObject(widget.configJson));
        const updatedWidget = await this.prisma.$transaction(async (tx) => {
            const savedWidget = await tx.dashboardWidget.update({
                where: {
                    id: widget.id
                },
                data: {
                    positionX: Math.max(0, Math.round(input.x)),
                    positionY: Math.max(0, Math.round(input.y)),
                    width: Math.max(1, Math.round(input.width)),
                    height: Math.max(widget.minHeight, Math.round(input.height)),
                    configJson: normalizedConfig,
                    configHash: nextConfigHash,
                    version: {
                        increment: 1
                    }
                }
            });
            const connectorBinding = getWidgetConnectorBinding(widget.widgetType);
            if (connectorBinding) {
                await tx.widgetConnector.deleteMany({
                    where: {
                        dashboardWidgetId: widget.id,
                        usageRole: connectorBinding.usageRole
                    }
                });
                if (typeof normalizedConfig.connectionId === 'string' && normalizedConfig.connectionId.trim()) {
                    const connector = await tx.connector.findFirst({
                        where: {
                            id: normalizedConfig.connectionId,
                            tenantId: widget.tenantId,
                            connectorType: {
                                in: connectorBinding.connectorTypes
                            }
                        }
                    });
                    if (!connector) {
                        throw new Error('Selected connection was not found.');
                    }
                    await tx.widgetConnector.create({
                        data: {
                            dashboardWidgetId: widget.id,
                            connectorId: connector.id,
                            usageRole: connectorBinding.usageRole
                        }
                    });
                }
            }
            return tx.dashboardWidget.findFirstOrThrow({
                where: {
                    id: savedWidget.id,
                    archivedAt: null
                },
                include: {
                    dashboard: true,
                    connectors: {
                        include: {
                            connector: true
                        }
                    }
                }
            });
        });
        return {
            ...mapDashboardWidgetRecord(updatedWidget),
            shouldRefreshSnapshot: currentConfigHash !== nextConfigHash
        };
    }
    async archive(input) {
        const widget = await this.prisma.dashboardWidget.findFirst({
            where: {
                id: input.widgetId,
                dashboardId: input.dashboardId,
                archivedAt: null,
                dashboard: {
                    ownerUserId: input.ownerUserId,
                    archivedAt: null
                }
            }
        });
        if (!widget) {
            return false;
        }
        await this.prisma.dashboardWidget.update({
            where: {
                id: widget.id
            },
            data: {
                archivedAt: new Date(),
                isVisible: false
            }
        });
        return true;
    }
}
function mapDashboardWidgetRecord(widget) {
    const definition = getWidgetDefinition(widget.widgetType);
    const config = withConnectionConfig(asObject(widget.configJson), widget.connectors);
    return {
        id: widget.id,
        tenantId: widget.tenantId || '',
        dashboardId: widget.dashboardId,
        ownerUserId: widget.dashboard ? widget.dashboard.ownerUserId : '',
        type: widget.widgetType,
        title: definition && widget.widgetType === 'weather' ? definition.title : widget.title,
        x: widget.positionX,
        y: widget.positionY,
        width: widget.width,
        height: widget.height,
        minWidth: widget.minWidth,
        minHeight: widget.minHeight,
        isVisible: widget.isVisible,
        sortOrder: widget.sortOrder,
        refreshMode: widget.refreshMode,
        version: widget.version,
        config: config,
        configHash: widget.configHash || hashWidgetConfig(config),
        data: definition ? definition.createMockData(config) : {},
        connections: (widget.connectors || []).map(mapWidgetConnection),
        createdAt: widget.createdAt,
        updatedAt: widget.updatedAt
    };
}
function asObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return {};
}
function normalizeWidgetConfig(config) {
    return Object.keys(config).reduce(function build(next, key) {
        if (typeof config[key] === 'undefined') {
            return next;
        }
        next[key] = config[key];
        return next;
    }, {});
}
function withConnectionConfig(config, connectors) {
    const nextConfig = { ...config };
    applyConnectorConfig(nextConfig, connectors, 'tasks');
    applyConnectorConfig(nextConfig, connectors, 'calendar');
    applyConnectorConfig(nextConfig, connectors, 'llm');
    return nextConfig;
}
function getWidgetConnectorBinding(widgetType) {
    if (widgetType === 'tasks') {
        return {
            usageRole: 'tasks',
            connectorTypes: ['todoist']
        };
    }
    if (widgetType === 'calendar') {
        return {
            usageRole: 'calendar',
            connectorTypes: ['google-calendar']
        };
    }
    if (widgetType === 'news') {
        return {
            usageRole: 'llm',
            connectorTypes: ['openai']
        };
    }
    return null;
}
function applyConnectorConfig(nextConfig, connectors, usageRole) {
    const connector = (connectors || []).find(function findConnector(item) {
        return item.usageRole === usageRole;
    });
    if (!connector) {
        return;
    }
    nextConfig.connectionId = connector.connector.id;
    nextConfig.connectionName = connector.connector.name;
    nextConfig.provider = connector.connector.connectorType;
}
function mapWidgetConnection(connection) {
    return {
        id: connection.connector.id,
        usageRole: connection.usageRole,
        connector: {
            id: connection.connector.id,
            type: connection.connector.connectorType,
            name: connection.connector.name,
            status: connection.connector.status,
            authType: connection.connector.authType,
            baseUrl: connection.connector.baseUrl,
            config: asObject(connection.connector.configJson),
            lastSyncAt: connection.connector.lastSyncAt,
            createdAt: connection.connector.createdAt,
            updatedAt: connection.connector.updatedAt
        }
    };
}
