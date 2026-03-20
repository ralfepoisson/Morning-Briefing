import type { GenerateWidgetSnapshotRequested, SnapshotTriggerSource } from './snapshot-job-types.js';

export type PublishWidgetSnapshotJobInput = {
  widgetId: string;
  dashboardId: string;
  tenantId: string;
  userId: string;
  widgetConfigVersion: number;
  widgetConfigHash: string;
  snapshotDate: string;
  triggerSource: SnapshotTriggerSource;
  correlationId?: string | null;
  causationId?: string | null;
  requestedAt?: Date;
};

export interface SnapshotJobPublisher {
  publishGenerateWidgetSnapshot(input: PublishWidgetSnapshotJobInput): Promise<GenerateWidgetSnapshotRequested>;
}
