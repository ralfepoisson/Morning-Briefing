import type { WidgetRepository } from './widget-repository.js';
import type {
  ArchiveDashboardWidgetInput,
  CreateDashboardWidgetInput,
  DashboardWidgetResponse,
  UpdateDashboardWidgetInput
} from './widget-types.js';
import type { SnapshotJobPublisher } from '../snapshots/snapshot-job-publisher.js';
import { formatSnapshotDateForTimezone } from '../snapshots/snapshot-date.js';

export class WidgetService {
  constructor(
    private readonly repository: WidgetRepository,
    private readonly snapshotJobPublisher: SnapshotJobPublisher | null = null
  ) {}

  async listForDashboard(dashboardId: string, ownerUserId: string): Promise<DashboardWidgetResponse[]> {
    const widgets = await this.repository.listForDashboard(dashboardId, ownerUserId);

    return widgets.map(toResponse);
  }

  async create(input: CreateDashboardWidgetInput): Promise<DashboardWidgetResponse> {
    const widget = await this.repository.create(input);

    if (this.snapshotJobPublisher) {
      await this.snapshotJobPublisher.publishGenerateWidgetSnapshot({
        widgetId: widget.id,
        dashboardId: widget.dashboardId,
        tenantId: widget.tenantId,
        userId: widget.ownerUserId || input.ownerUserId,
        widgetConfigVersion: widget.version,
        widgetConfigHash: widget.configHash,
        snapshotDate: formatSnapshotDateForTimezone(new Date(), input.timezone || 'UTC'),
        triggerSource: 'config_updated',
        correlationId: input.correlationId || null,
        causationId: input.causationId || null
      });
    }

    return toResponse(widget);
  }

  async update(input: UpdateDashboardWidgetInput): Promise<DashboardWidgetResponse | null> {
    const widget = await this.repository.update(input);

    if (widget && widget.shouldRefreshSnapshot && this.snapshotJobPublisher) {
      await this.snapshotJobPublisher.publishGenerateWidgetSnapshot({
        widgetId: widget.id,
        dashboardId: widget.dashboardId,
        tenantId: widget.tenantId,
        userId: widget.ownerUserId || input.ownerUserId,
        widgetConfigVersion: widget.version,
        widgetConfigHash: widget.configHash,
        snapshotDate: formatSnapshotDateForTimezone(new Date(), input.timezone || 'UTC'),
        triggerSource: 'config_updated',
        correlationId: input.correlationId || null,
        causationId: input.causationId || null
      });
    }

    return widget ? toResponse(widget) : null;
  }

  async archive(input: ArchiveDashboardWidgetInput): Promise<boolean> {
    return this.repository.archive(input);
  }
}

function toResponse(widget: {
  id: string;
  dashboardId: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  isVisible: boolean;
  isGenerating: boolean;
  sortOrder: number;
  data: Record<string, unknown>;
  config: Record<string, unknown>;
  includeInBriefingDefault: boolean;
  includeInBriefingOverride: boolean | null;
  includeInBriefing: boolean;
  createdAt: Date;
  updatedAt: Date;
}): DashboardWidgetResponse {
  return {
    id: widget.id,
    dashboardId: widget.dashboardId,
    type: widget.type,
    title: widget.title,
    x: widget.x,
    y: widget.y,
    width: widget.width,
    height: widget.height,
    minWidth: widget.minWidth,
    minHeight: widget.minHeight,
    isVisible: widget.isVisible,
    isGenerating: widget.isGenerating,
    sortOrder: widget.sortOrder,
    config: widget.config,
    includeInBriefingDefault: widget.includeInBriefingDefault,
    includeInBriefingOverride: widget.includeInBriefingOverride,
    includeInBriefing: widget.includeInBriefing,
    data: widget.data,
    createdAt: widget.createdAt.toISOString(),
    updatedAt: widget.updatedAt.toISOString()
  };
}
