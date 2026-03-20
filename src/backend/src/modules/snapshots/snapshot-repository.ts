import type { DashboardWidgetRecord } from '../widgets/widget-types.js';
import type { GenerateWidgetSnapshotRequested } from './snapshot-job-types.js';
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

export type ClaimSnapshotJobResult =
  | { status: 'claimed'; jobId: string; attemptCount: number }
  | { status: 'already_processed'; jobId: string }
  | { status: 'already_processing'; jobId: string };

export type UpsertWidgetSnapshotInput = {
  widget: DashboardWidgetRecord;
  snapshotDate: string;
  widgetSnapshot: DashboardSnapshotWidgetRecord;
};

export interface SnapshotRepository {
  findDashboardWithWidgets(dashboardId: string, ownerUserId: string): Promise<SnapshotDashboardRecord | null>;
  upsertDashboardSnapshot(input: UpsertDashboardSnapshotInput): Promise<DashboardSnapshotRecord>;
  findWidgetForSnapshotGeneration(widgetId: string): Promise<DashboardWidgetRecord | null>;
  listWidgetsForScheduledRefresh(): Promise<DashboardWidgetRecord[]>;
  claimSnapshotJob(message: GenerateWidgetSnapshotRequested, messageReceiptId: string | null): Promise<ClaimSnapshotJobResult>;
  completeSnapshotJob(idempotencyKey: string): Promise<void>;
  skipSnapshotJob(idempotencyKey: string, reason: string): Promise<void>;
  failSnapshotJob(idempotencyKey: string, reason: string): Promise<void>;
  upsertWidgetSnapshot(input: UpsertWidgetSnapshotInput): Promise<void>;
}
