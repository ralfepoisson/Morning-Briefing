import { logApplicationEvent, toLogErrorContext } from '../admin/application-logger.js';
import type { DashboardBriefingService } from './dashboard-briefing-service.js';
import type { GenerateDashboardAudioBriefingEnvelope, GenerateDashboardAudioBriefingRequested } from './dashboard-briefing-job-types.js';

export type DashboardBriefingQueueMessage = {
  body: string;
  messageId?: string;
  receiptHandle?: string;
};

export class DashboardBriefingJobProcessor {
  constructor(
    private readonly service: Pick<DashboardBriefingService, 'generateBriefing'>
  ) {}

  async process(message: DashboardBriefingQueueMessage): Promise<'processed'> {
    const payload = parseGenerateDashboardAudioBriefingMessage(message.body);

    logApplicationEvent({
      level: 'info',
      scope: 'dashboard-briefing',
      event: 'dashboard_briefing_job_dequeued',
      message: 'Dashboard audio briefing job dequeued.',
      context: {
        jobId: payload.jobId,
        dashboardId: payload.dashboardId,
        ownerUserId: payload.ownerUserId,
        force: payload.force,
        sqsMessageId: message.messageId || null
      }
    });

    try {
      await this.service.generateBriefing(
        payload.dashboardId,
        {
          tenantId: payload.tenantId,
          userId: payload.ownerUserId,
          displayName: payload.ownerDisplayName,
          timezone: payload.ownerTimezone,
          locale: payload.ownerLocale,
          email: payload.ownerEmail,
          isAdmin: payload.ownerIsAdmin
        },
        {
          force: payload.force
        }
      );

      logApplicationEvent({
        level: 'info',
        scope: 'dashboard-briefing',
        event: 'dashboard_briefing_job_processed',
        message: 'Dashboard audio briefing job processed.',
        context: {
          jobId: payload.jobId,
          dashboardId: payload.dashboardId,
          ownerUserId: payload.ownerUserId
        }
      });

      return 'processed';
    } catch (error) {
      logApplicationEvent({
        level: 'error',
        scope: 'dashboard-briefing',
        event: 'dashboard_briefing_job_failed',
        message: error instanceof Error ? error.message : 'Dashboard audio briefing job failed.',
        context: {
          jobId: payload.jobId,
          dashboardId: payload.dashboardId,
          ownerUserId: payload.ownerUserId,
          ...toLogErrorContext(error)
        }
      });
      throw error;
    }
  }
}

export function parseGenerateDashboardAudioBriefingMessage(body: string): GenerateDashboardAudioBriefingRequested {
  const parsed = JSON.parse(body) as GenerateDashboardAudioBriefingEnvelope;

  if (!parsed || parsed.type !== 'GenerateDashboardAudioBriefingRequested' || !parsed.payload) {
    throw new Error('Dashboard briefing queue message is invalid.');
  }

  const payload = parsed.payload;

  if (
    payload.schemaVersion !== 1 ||
    typeof payload.jobId !== 'string' ||
    typeof payload.dashboardId !== 'string' ||
    typeof payload.tenantId !== 'string' ||
    typeof payload.ownerUserId !== 'string' ||
    typeof payload.ownerDisplayName !== 'string' ||
    typeof payload.ownerTimezone !== 'string' ||
    typeof payload.ownerLocale !== 'string' ||
    typeof payload.ownerEmail !== 'string' ||
    typeof payload.ownerIsAdmin !== 'boolean' ||
    typeof payload.force !== 'boolean' ||
    typeof payload.requestedAt !== 'string'
  ) {
    throw new Error('Dashboard briefing queue message payload is invalid.');
  }

  return payload;
}
