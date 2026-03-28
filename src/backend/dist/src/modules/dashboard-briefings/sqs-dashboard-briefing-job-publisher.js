import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { logApplicationEvent } from '../admin/application-logger.js';
import { createSnapshotJobId } from '../snapshots/snapshot-job-utils.js';
export class SqsDashboardBriefingJobPublisher {
    sqs;
    queueUrl;
    constructor(sqs, queueUrl) {
        this.sqs = sqs;
        this.queueUrl = queueUrl;
    }
    async publishGenerateDashboardAudioBriefing(input) {
        const requestedAt = input.requestedAt || new Date();
        const payload = {
            schemaVersion: 1,
            jobId: createSnapshotJobId(),
            dashboardId: input.dashboardId,
            tenantId: input.tenantId,
            ownerUserId: input.ownerUserId,
            ownerDisplayName: input.ownerDisplayName,
            ownerPhoneticName: input.ownerPhoneticName,
            ownerTimezone: input.ownerTimezone,
            ownerLocale: input.ownerLocale,
            ownerEmail: input.ownerEmail,
            ownerIsAdmin: input.ownerIsAdmin,
            force: input.force,
            correlationId: input.correlationId || null,
            causationId: input.causationId || null,
            requestedAt: requestedAt.toISOString()
        };
        const message = {
            type: 'GenerateDashboardAudioBriefingRequested',
            payload
        };
        await this.sqs.send(new SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify(message)
        }));
        logApplicationEvent({
            level: 'info',
            scope: 'dashboard-briefing',
            event: 'dashboard_briefing_job_enqueued',
            message: 'Dashboard audio briefing job enqueued.',
            context: {
                jobId: payload.jobId,
                dashboardId: payload.dashboardId,
                ownerUserId: payload.ownerUserId,
                force: payload.force
            }
        });
        return payload;
    }
}
