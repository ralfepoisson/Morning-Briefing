import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getWidgetDefinition } from '../widgets/widget-definitions.js';
import type { DashboardWidgetRecord } from '../widgets/widget-types.js';
import type {
  DashboardSnapshotRecord,
  DashboardSnapshotWidgetRecord
} from './snapshot-types.js';
import type {
  SnapshotDashboardRecord,
  SnapshotRepository,
  UpsertDashboardSnapshotInput
} from './snapshot-repository.js';

export class PrismaSnapshotRepository implements SnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findDashboardWithWidgets(dashboardId: string, ownerUserId: string): Promise<SnapshotDashboardRecord | null> {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: {
        id: dashboardId,
        ownerUserId
      },
      include: {
        widgets: {
          orderBy: [
            { sortOrder: 'asc' },
            { createdAt: 'asc' }
          ]
        }
      }
    });

    if (!dashboard) {
      return null;
    }

    return {
      id: dashboard.id,
      tenantId: dashboard.tenantId,
      ownerUserId: dashboard.ownerUserId,
      name: dashboard.name,
      description: dashboard.description || '',
      widgets: dashboard.widgets.map(mapDashboardWidgetRecord)
    };
  }

  async upsertDashboardSnapshot(input: UpsertDashboardSnapshotInput): Promise<DashboardSnapshotRecord> {
    const snapshot = await this.prisma.briefingSnapshot.upsert({
      where: {
        userId_dashboardId_snapshotDate: {
          userId: input.userId,
          dashboardId: input.dashboardId,
          snapshotDate: input.snapshotDate
        }
      },
      update: {
        generationStatus: input.generationStatus,
        summaryJson: input.summary,
        generatedAt: new Date()
      },
      create: {
        tenantId: input.tenantId,
        userId: input.userId,
        dashboardId: input.dashboardId,
        snapshotDate: input.snapshotDate,
        generationStatus: input.generationStatus,
        summaryJson: input.summary
      }
    });

    const widgetSnapshots: DashboardSnapshotWidgetRecord[] = [];

    for (const widget of input.widgets) {
      const existingWidgetSnapshot = await this.prisma.widgetSnapshot.findFirst({
        where: {
          snapshotId: snapshot.id,
          dashboardWidgetId: widget.widgetId
        }
      });

      const contentHash = createHash('sha256').update(JSON.stringify(widget.content || {})).digest('hex');
      const savedWidgetSnapshot = existingWidgetSnapshot
        ? await this.prisma.widgetSnapshot.update({
            where: {
              id: existingWidgetSnapshot.id
            },
            data: {
              widgetType: widget.widgetType,
              title: widget.title,
              status: widget.status,
              contentJson: widget.content,
              contentHash: contentHash,
              errorMessage: widget.errorMessage,
              generatedAt: widget.generatedAt
            }
          })
        : await this.prisma.widgetSnapshot.create({
            data: {
              snapshotId: snapshot.id,
              dashboardWidgetId: widget.widgetId,
              widgetType: widget.widgetType,
              title: widget.title,
              status: widget.status,
              contentJson: widget.content,
              contentHash: contentHash,
              errorMessage: widget.errorMessage,
              generatedAt: widget.generatedAt
            }
          });

      widgetSnapshots.push({
        widgetId: savedWidgetSnapshot.dashboardWidgetId,
        widgetType: savedWidgetSnapshot.widgetType,
        title: savedWidgetSnapshot.title,
        status: savedWidgetSnapshot.status,
        content: asObject(savedWidgetSnapshot.contentJson),
        errorMessage: savedWidgetSnapshot.errorMessage,
        generatedAt: savedWidgetSnapshot.generatedAt
      });
    }

    return {
      id: snapshot.id,
      dashboardId: snapshot.dashboardId,
      userId: snapshot.userId,
      snapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
      generationStatus: snapshot.generationStatus,
      summary: asObject(snapshot.summaryJson),
      generatedAt: snapshot.generatedAt,
      widgets: widgetSnapshots
    };
  }
}

function mapDashboardWidgetRecord(widget: {
  id: string;
  dashboardId: string;
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
    ownerUserId: '',
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
