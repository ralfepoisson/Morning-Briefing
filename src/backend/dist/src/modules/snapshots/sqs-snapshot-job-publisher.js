import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { logSnapshotJob } from './snapshot-job-logger.js';
import { createSnapshotJobId, buildSnapshotJobIdempotencyKey } from './snapshot-job-utils.js';
export class SqsSnapshotJobPublisher {
    sqs;
    queueUrl;
    constructor(sqs, queueUrl) {
        this.sqs = sqs;
        this.queueUrl = queueUrl;
    }
    async publishGenerateWidgetSnapshot(input) {
        const requestedAt = input.requestedAt || new Date();
        const payload = {
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
        const message = {
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
export class NoopSnapshotJobPublisher {
    async publishGenerateWidgetSnapshot(input) {
        const requestedAt = input.requestedAt || new Date();
        const payload = {
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
