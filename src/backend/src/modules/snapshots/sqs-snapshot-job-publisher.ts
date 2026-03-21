import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import { logSnapshotJob } from './snapshot-job-logger.js';
import type { SnapshotJobPublisher, PublishWidgetSnapshotJobInput } from './snapshot-job-publisher.js';
import type { GenerateWidgetSnapshotEnvelope, GenerateWidgetSnapshotRequested } from './snapshot-job-types.js';
import { createSnapshotJobId, buildSnapshotJobIdempotencyKey } from './snapshot-job-utils.js';

export class SqsSnapshotJobPublisher implements SnapshotJobPublisher {
  constructor(
    private readonly sqs: Pick<SQSClient, 'send'>,
    private readonly queueUrl: string
  ) {}

  async publishGenerateWidgetSnapshot(input: PublishWidgetSnapshotJobInput): Promise<GenerateWidgetSnapshotRequested> {
    const requestedAt = input.requestedAt || new Date();
    const payload: GenerateWidgetSnapshotRequested = {
      schemaVersion: 1,
      jobId: createSnapshotJobId(),
      idempotencyKey: buildSnapshotJobIdempotencyKey({
        widgetId: input.widgetId,
        snapshotDate: input.snapshotDate,
        widgetConfigHash: input.widgetConfigHash,
        triggerSource: input.triggerSource,
        requestedAt,
        bypassDuplicateCheck: input.bypassDuplicateCheck
      }),
      widgetId: input.widgetId,
      dashboardId: input.dashboardId,
      tenantId: input.tenantId,
      userId: input.userId,
      widgetConfigVersion: input.widgetConfigVersion,
      widgetConfigHash: input.widgetConfigHash,
      snapshotDate: input.snapshotDate,
      snapshotPeriod: 'day',
      triggerSource: input.triggerSource,
      bypassDuplicateCheck: input.bypassDuplicateCheck === true,
      correlationId: input.correlationId || null,
      causationId: input.causationId || null,
      requestedAt: requestedAt.toISOString()
    };
    const message: GenerateWidgetSnapshotEnvelope = {
      type: 'GenerateWidgetSnapshotRequested',
      payload
    };

    await this.sqs.send(new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message)
    }));

    logSnapshotJob('info', 'snapshot_job_enqueued', {
      jobId: payload.jobId,
      idempotencyKey: payload.idempotencyKey,
      widgetId: payload.widgetId,
      dashboardId: payload.dashboardId,
      snapshotDate: payload.snapshotDate,
      triggerSource: payload.triggerSource
    });

    return payload;
  }
}

export class NoopSnapshotJobPublisher implements SnapshotJobPublisher {
  async publishGenerateWidgetSnapshot(input: PublishWidgetSnapshotJobInput): Promise<GenerateWidgetSnapshotRequested> {
    const requestedAt = input.requestedAt || new Date();
    const payload: GenerateWidgetSnapshotRequested = {
      schemaVersion: 1,
      jobId: createSnapshotJobId(),
      idempotencyKey: buildSnapshotJobIdempotencyKey({
        widgetId: input.widgetId,
        snapshotDate: input.snapshotDate,
        widgetConfigHash: input.widgetConfigHash,
        triggerSource: input.triggerSource,
        requestedAt,
        bypassDuplicateCheck: input.bypassDuplicateCheck
      }),
      widgetId: input.widgetId,
      dashboardId: input.dashboardId,
      tenantId: input.tenantId,
      userId: input.userId,
      widgetConfigVersion: input.widgetConfigVersion,
      widgetConfigHash: input.widgetConfigHash,
      snapshotDate: input.snapshotDate,
      snapshotPeriod: 'day',
      triggerSource: input.triggerSource,
      bypassDuplicateCheck: input.bypassDuplicateCheck === true,
      correlationId: input.correlationId || null,
      causationId: input.causationId || null,
      requestedAt: requestedAt.toISOString()
    };

    logSnapshotJob('info', 'snapshot_job_enqueue_skipped', {
      reason: 'queue_disabled',
      jobId: payload.jobId,
      idempotencyKey: payload.idempotencyKey,
      widgetId: payload.widgetId,
      dashboardId: payload.dashboardId,
      snapshotDate: payload.snapshotDate,
      triggerSource: payload.triggerSource
    });

    return payload;
  }
}
