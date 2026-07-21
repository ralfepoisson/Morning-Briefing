import { logApplicationEvent } from '../admin/application-logger.js';
import { createSnapshotJobId } from '../snapshots/snapshot-job-utils.js';
import type { GenerateDashboardAudioBriefingEnvelope, GenerateDashboardAudioBriefingRequested } from './dashboard-briefing-job-types.js';
import type { DashboardBriefingJobPublisher, PublishDashboardAudioBriefingJobInput } from './dashboard-briefing-job-publisher.js';

type BrokerPublisher = { publish(envelope: unknown, messageId: string): Promise<void> };

export class RabbitMqDashboardBriefingJobPublisher implements DashboardBriefingJobPublisher {
  constructor(private readonly broker: BrokerPublisher) {}

  async publishGenerateDashboardAudioBriefing(
    input: PublishDashboardAudioBriefingJobInput
  ): Promise<GenerateDashboardAudioBriefingRequested> {
    const requestedAt = input.requestedAt || new Date();
    const jobId = createSnapshotJobId();
    const payload: GenerateDashboardAudioBriefingRequested = {
      schemaVersion: 1,
      jobId,
      idempotencyKey: input.idempotencyKey || jobId,
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
    await this.broker.publish(message, payload.jobId);
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
