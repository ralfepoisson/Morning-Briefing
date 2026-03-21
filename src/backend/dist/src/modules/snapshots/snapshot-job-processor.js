import { logSnapshotJob } from './snapshot-job-logger.js';
export class SnapshotJobProcessor {
    repository;
    snapshotService;
    constructor(repository, snapshotService) {
        this.repository = repository;
        this.snapshotService = snapshotService;
    }
    async process(message) {
        const payload = parseGenerateWidgetSnapshotMessage(message.body);
        logSnapshotJob('info', 'snapshot_job_dequeued', {
            jobId: payload.jobId,
            idempotencyKey: payload.idempotencyKey,
            widgetId: payload.widgetId,
            dashboardId: payload.dashboardId,
            snapshotDate: payload.snapshotDate,
            triggerSource: payload.triggerSource,
            sqsMessageId: message.messageId || null
        });
        const claim = await this.repository.claimSnapshotJob(payload, message.messageId || message.receiptHandle || null);
        if (claim.status !== 'claimed') {
            logSnapshotJob('info', 'snapshot_job_duplicate_skipped', {
                jobId: payload.jobId,
                idempotencyKey: payload.idempotencyKey,
                widgetId: payload.widgetId,
                dashboardId: payload.dashboardId,
                snapshotDate: payload.snapshotDate,
                triggerSource: payload.triggerSource,
                reason: claim.status
            });
            return 'skipped';
        }
        logSnapshotJob('info', 'snapshot_job_processing_started', {
            jobId: payload.jobId,
            idempotencyKey: payload.idempotencyKey,
            widgetId: payload.widgetId,
            dashboardId: payload.dashboardId,
            snapshotDate: payload.snapshotDate,
            triggerSource: payload.triggerSource,
            attemptCount: claim.attemptCount
        });
        try {
            const result = await this.snapshotService.generateForWidget(payload);
            if (result.status === 'skipped') {
                await this.repository.skipSnapshotJob(payload.idempotencyKey, result.reason || 'skipped');
                logSnapshotJob('warn', 'snapshot_job_skipped', {
                    jobId: payload.jobId,
                    idempotencyKey: payload.idempotencyKey,
                    widgetId: payload.widgetId,
                    dashboardId: payload.dashboardId,
                    snapshotDate: payload.snapshotDate,
                    triggerSource: payload.triggerSource,
                    reason: result.reason || 'skipped'
                });
                return 'skipped';
            }
            await this.repository.completeSnapshotJob(payload.idempotencyKey);
            logSnapshotJob('info', 'snapshot_job_processed', {
                jobId: payload.jobId,
                idempotencyKey: payload.idempotencyKey,
                widgetId: payload.widgetId,
                dashboardId: payload.dashboardId,
                snapshotDate: payload.snapshotDate,
                triggerSource: payload.triggerSource
            });
            return 'processed';
        }
        catch (error) {
            const messageText = error instanceof Error ? error.message : 'Snapshot job processing failed.';
            await this.repository.failSnapshotJob(payload.idempotencyKey, messageText);
            logSnapshotJob('error', 'snapshot_job_failed', {
                jobId: payload.jobId,
                idempotencyKey: payload.idempotencyKey,
                widgetId: payload.widgetId,
                dashboardId: payload.dashboardId,
                snapshotDate: payload.snapshotDate,
                triggerSource: payload.triggerSource,
                error: messageText
            });
            throw error;
        }
    }
}
export function parseGenerateWidgetSnapshotMessage(body) {
    const parsed = JSON.parse(body);
    if (!parsed || parsed.type !== 'GenerateWidgetSnapshotRequested' || !parsed.payload) {
        throw new Error('Snapshot queue message is invalid.');
    }
    const payload = parsed.payload;
    if (payload.schemaVersion !== 1 ||
        typeof payload.jobId !== 'string' ||
        typeof payload.idempotencyKey !== 'string' ||
        typeof payload.widgetId !== 'string' ||
        typeof payload.dashboardId !== 'string' ||
        typeof payload.tenantId !== 'string' ||
        typeof payload.userId !== 'string' ||
        typeof payload.widgetConfigVersion !== 'number' ||
        typeof payload.widgetConfigHash !== 'string' ||
        typeof payload.snapshotDate !== 'string' ||
        payload.snapshotPeriod !== 'day' ||
        typeof payload.triggerSource !== 'string' ||
        typeof payload.requestedAt !== 'string') {
        throw new Error('Snapshot queue message payload is invalid.');
    }
    return payload;
}
