import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import { logApplicationEvent } from '../admin/application-logger.js';
import { createSnapshotJobId } from '../snapshots/snapshot-job-utils.js';
import type { GenerateDashboardAudioBriefingEnvelope, GenerateDashboardAudioBriefingRequested } from './dashboard-briefing-job-types.js';
import type { DashboardBriefingJobPublisher, PublishDashboardAudioBriefingJobInput } from './dashboard-briefing-job-publisher.js';

export class SqsDashboardBriefingJobPublisher implements DashboardBriefingJobPublisher {
  constructor(
    private readonly sqs: Pick<SQSClient, 'send'>,
    private readonly queueUrl: string
  ) {}

  async publishGenerateDashboardAudioBriefing(
    input: PublishDashboardAudioBriefingJobInput
  ): Promise<GenerateDashboardAudioBriefingRequested> {
    const requestedAt = input.requestedAt || new Date();
    const payload: GenerateDashboardAudioBriefingRequested = {
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
    const message: GenerateDashboardAudioBriefingEnvelope = {
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
