import type { DashboardWidgetRecord } from '../widgets/widget-types.js';
import type { DashboardSnapshotRecord, DashboardSnapshotWidgetRecord } from './snapshot-types.js';

export type SnapshotDashboardRecord = {
  id: string;
  tenantId: string;
  ownerUserId: string;
  name: string;
  description: string;
  widgets: DashboardWidgetRecord[];
};

export type UpsertDashboardSnapshotInput = {
  tenantId: string;
  userId: string;
  dashboardId: string;
  snapshotDate: Date;
  generationStatus: 'PENDING' | 'READY' | 'FAILED';
  summary: Record<string, unknown>;
  widgets: DashboardSnapshotWidgetRecord[];
};

export interface SnapshotRepository {
  findDashboardWithWidgets(dashboardId: string, ownerUserId: string): Promise<SnapshotDashboardRecord | null>;
  upsertDashboardSnapshot(input: UpsertDashboardSnapshotInput): Promise<DashboardSnapshotRecord>;
}
