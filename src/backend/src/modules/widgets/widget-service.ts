import type { WidgetRepository } from './widget-repository.js';
import type {
  CreateDashboardWidgetInput,
  DashboardWidgetResponse,
  UpdateDashboardWidgetInput
} from './widget-types.js';

export class WidgetService {
  constructor(private readonly repository: WidgetRepository) {}

  async listForDashboard(dashboardId: string, ownerUserId: string): Promise<DashboardWidgetResponse[]> {
    const widgets = await this.repository.listForDashboard(dashboardId, ownerUserId);

    return widgets.map(toResponse);
  }

  async create(input: CreateDashboardWidgetInput): Promise<DashboardWidgetResponse> {
    const widget = await this.repository.create(input);

    return toResponse(widget);
  }

  async update(input: UpdateDashboardWidgetInput): Promise<DashboardWidgetResponse | null> {
    const widget = await this.repository.update(input);

    return widget ? toResponse(widget) : null;
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
  sortOrder: number;
  data: Record<string, unknown>;
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
    sortOrder: widget.sortOrder,
    data: widget.data,
    createdAt: widget.createdAt.toISOString(),
    updatedAt: widget.updatedAt.toISOString()
  };
}
