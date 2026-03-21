export type SnapshotTriggerSource = 'config_updated' | 'scheduled_refresh' | 'manual_refresh';

export type GenerateWidgetSnapshotRequested = {
  schemaVersion: 1;
  jobId: string;
  idempotencyKey: string;
  widgetId: string;
  dashboardId: string;
  tenantId: string;
  userId: string;
  widgetConfigVersion: number;
  widgetConfigHash: string;
  snapshotDate: string;
  snapshotPeriod: 'day';
  triggerSource: SnapshotTriggerSource;
  bypassDuplicateCheck: boolean;
  correlationId: string | null;
  causationId: string | null;
  requestedAt: string;
};

export type GenerateWidgetSnapshotEnvelope = {
  type: 'GenerateWidgetSnapshotRequested';
  payload: GenerateWidgetSnapshotRequested;
};

export type SnapshotJobLogContext = {
  jobId: string;
  idempotencyKey: string;
  widgetId: string;
  dashboardId: string;
  snapshotDate: string;
  triggerSource: SnapshotTriggerSource;
};
