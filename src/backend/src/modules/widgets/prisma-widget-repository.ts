import type { PrismaClient } from '@prisma/client';
import type { WidgetRepository } from './widget-repository.js';
import type {
  CreateDashboardWidgetInput,
  DashboardWidgetRecord,
  UpdateDashboardWidgetInput
} from './widget-types.js';
import { getWidgetDefinition } from './widget-definitions.js';

export class PrismaWidgetRepository implements WidgetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listForDashboard(dashboardId: string, ownerUserId: string): Promise<DashboardWidgetRecord[]> {
    const widgets = await this.prisma.dashboardWidget.findMany({
      where: {
        dashboardId,
        dashboard: {
          ownerUserId
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return widgets.map(mapDashboardWidgetRecord);
  }

  async create(input: CreateDashboardWidgetInput): Promise<DashboardWidgetRecord> {
    const definition = getWidgetDefinition(input.type);

    if (!definition) {
      throw new Error('Widget type is not supported.');
    }

    const dashboard = await this.prisma.dashboard.findFirst({
      where: {
        id: input.dashboardId,
        ownerUserId: input.ownerUserId
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
        configJson: definition.createDefaultConfig()
      }
    });

    return mapDashboardWidgetRecord(widget);
  }

  async update(input: UpdateDashboardWidgetInput): Promise<DashboardWidgetRecord | null> {
    const widget = await this.prisma.dashboardWidget.findFirst({
      where: {
        id: input.widgetId,
        dashboardId: input.dashboardId,
        dashboard: {
          ownerUserId: input.ownerUserId
        }
      }
    });

    if (!widget) {
      return null;
    }

    const updatedWidget = await this.prisma.dashboardWidget.update({
      where: {
        id: widget.id
      },
      data: {
        positionX: Math.max(0, Math.round(input.x)),
        positionY: Math.max(0, Math.round(input.y)),
        width: Math.max(1, Math.round(input.width)),
        height: Math.max(widget.minHeight, Math.round(input.height)),
        configJson: input.config || widget.configJson || {},
        version: {
          increment: 1
        }
      }
    });

    return mapDashboardWidgetRecord(updatedWidget);
  }
}

function mapDashboardWidgetRecord(widget: {
  id: string;
  dashboardId: string;
  dashboard: { ownerUserId: string } | undefined;
  widgetType: string;
  title: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  isVisible: boolean;
  sortOrder: number;
  configJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DashboardWidgetRecord {
  const definition = getWidgetDefinition(widget.widgetType);

  return {
    id: widget.id,
    dashboardId: widget.dashboardId,
    ownerUserId: widget.dashboard ? widget.dashboard.ownerUserId : '',
    type: widget.widgetType,
    title: widget.title,
    x: widget.positionX,
    y: widget.positionY,
    width: widget.width,
    height: widget.height,
    minWidth: widget.minWidth,
    minHeight: widget.minHeight,
    isVisible: widget.isVisible,
    sortOrder: widget.sortOrder,
      config: asObject(widget.configJson),
      data: definition ? definition.createMockData(asObject(widget.configJson)) : {},
      createdAt: widget.createdAt,
      updatedAt: widget.updatedAt
    };
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
