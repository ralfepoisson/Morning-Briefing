import { getWidgetDefinition } from './widget-definitions.js';
import { hashWidgetConfig } from '../snapshots/snapshot-job-utils.js';
export class PrismaWidgetRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listForDashboard(dashboardId, ownerUserId) {
        try {
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
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return this.listForDashboardLegacy(dashboardId, ownerUserId);
        }
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
        try {
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
                    configHash: hashWidgetConfig(defaultConfig),
                    includeInBriefingOverride: null
                }
            });
            return mapDashboardWidgetRecord(widget);
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
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
            return mapDashboardWidgetRecord({
                ...widget,
                includeInBriefingOverride: null
            });
        }
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
        const nextIncludeInBriefingOverride = typeof input.includeInBriefingOverride === 'boolean'
            ? input.includeInBriefingOverride
            : input.includeInBriefingOverride === null
                ? null
                : widget.includeInBriefingOverride;
        try {
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
                        includeInBriefingOverride: nextIncludeInBriefingOverride,
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
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
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
                ...mapDashboardWidgetRecord({
                    ...updatedWidget,
                    includeInBriefingOverride: null
                }),
                shouldRefreshSnapshot: currentConfigHash !== nextConfigHash
            };
        }
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
    async listForDashboardLegacy(dashboardId, ownerUserId) {
        const widgets = await this.prisma.$queryRawUnsafe(`
        SELECT
          w.id,
          w.tenant_id,
          w.dashboard_id,
          d.owner_user_id,
          w.widget_type,
          w.title,
          w.position_x,
          w.position_y,
          w.width,
          w.height,
          w.min_width,
          w.min_height,
          w.is_visible,
          w.refresh_mode,
          w.sort_order,
          w.version,
          w.config_json,
          w.config_hash,
          w.created_at,
          w.updated_at
        FROM dashboard_widgets w
        INNER JOIN dashboards d ON d.id = w.dashboard_id
        WHERE w.dashboard_id = CAST($1 AS uuid)
          AND w.archived_at IS NULL
          AND d.owner_user_id = CAST($2 AS uuid)
          AND d.archived_at IS NULL
        ORDER BY w.sort_order ASC, w.created_at ASC
      `, dashboardId, ownerUserId);
        const widgetIds = widgets.map(function mapWidget(widget) {
            return widget.id;
        });
        const connectors = widgetIds.length
            ? await this.prisma.widgetConnector.findMany({
                where: {
                    dashboardWidgetId: {
                        in: widgetIds
                    }
                },
                include: {
                    connector: true
                }
            })
            : [];
        return widgets.map((widget) => mapDashboardWidgetRecord({
            id: widget.id,
            tenantId: widget.tenant_id,
            dashboardId: widget.dashboard_id,
            dashboard: {
                ownerUserId: widget.owner_user_id
            },
            widgetType: widget.widget_type,
            title: widget.title,
            positionX: widget.position_x,
            positionY: widget.position_y,
            width: widget.width,
            height: widget.height,
            minWidth: widget.min_width,
            minHeight: widget.min_height,
            isVisible: widget.is_visible,
            refreshMode: widget.refresh_mode,
            sortOrder: widget.sort_order,
            version: widget.version,
            configJson: widget.config_json,
            configHash: widget.config_hash,
            includeInBriefingOverride: null,
            connectors: connectors.filter(function filterConnector(item) {
                return item.dashboardWidgetId === widget.id;
            }),
            createdAt: widget.created_at,
            updatedAt: widget.updated_at
        }));
    }
}
function mapDashboardWidgetRecord(widget) {
    const definition = getWidgetDefinition(widget.widgetType);
    const config = withConnectionConfig(asObject(widget.configJson), widget.connectors);
    const includeInBriefingDefault = definition ? definition.briefingDefaultIncluded : false;
    const includeInBriefingOverride = typeof widget.includeInBriefingOverride === 'boolean'
        ? widget.includeInBriefingOverride
        : null;
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
        includeInBriefingDefault,
        includeInBriefingOverride,
        includeInBriefing: includeInBriefingOverride === null ? includeInBriefingDefault : includeInBriefingOverride,
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
function isMissingBriefingSchemaError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const candidate = error;
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    return candidate.code === 'P2021'
        || candidate.code === 'P2022'
        || message.includes('include_in_briefing_override');
}
