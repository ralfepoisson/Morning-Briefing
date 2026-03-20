import type {
  ArchiveDashboardWidgetInput,
  CreateDashboardWidgetInput,
  DashboardWidgetRecord,
  UpdateDashboardWidgetInput
} from './widget-types.js';

export interface WidgetRepository {
  listForDashboard(dashboardId: string, ownerUserId: string): Promise<DashboardWidgetRecord[]>;
  create(input: CreateDashboardWidgetInput): Promise<DashboardWidgetRecord>;
  update(input: UpdateDashboardWidgetInput): Promise<DashboardWidgetRecord | null>;
  archive(input: ArchiveDashboardWidgetInput): Promise<boolean>;
}
