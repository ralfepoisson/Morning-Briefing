import { logApplicationEvent } from '../admin/application-logger.js';
import type { DashboardBriefingJobPublisher } from './dashboard-briefing-job-publisher.js';

export type ScheduledDashboardBriefingRecord = {
  id: string;
  tenantId: string;
  isGenerating: boolean;
  owner: {
    id: string;
    displayName: string;
    phoneticName: string | null;
    timezone: string;
    locale: string;
    email: string;
    isAdmin: boolean;
  };
  briefingPreference: {
    enabled: boolean;
  } | null;
};

export class ScheduledDashboardBriefingRefreshService {
  constructor(
    private readonly repository: {
      listDashboardsForScheduledGeneration(): Promise<ScheduledDashboardBriefingRecord[]>;
    },
    private readonly publisher: Pick<DashboardBriefingJobPublisher, 'publishGenerateDashboardAudioBriefing'>
  ) {}

  async enqueueAllDashboards(now: Date = new Date()): Promise<{
    enqueuedCount: number;
    skippedDisabledCount: number;
    skippedGeneratingCount: number;
  }> {
    const dashboards = await this.repository.listDashboardsForScheduledGeneration();
    let enqueuedCount = 0;
    let skippedDisabledCount = 0;
    let skippedGeneratingCount = 0;

    for (const dashboard of dashboards) {
      if (dashboard.isGenerating) {
        skippedGeneratingCount += 1;
        continue;
      }

      if (dashboard.briefingPreference && dashboard.briefingPreference.enabled === false) {
        skippedDisabledCount += 1;
        continue;
      }

      await this.publisher.publishGenerateDashboardAudioBriefing({
        dashboardId: dashboard.id,
        tenantId: dashboard.tenantId,
        ownerUserId: dashboard.owner.id,
        ownerDisplayName: dashboard.owner.displayName,
        ownerPhoneticName: dashboard.owner.phoneticName,
        ownerTimezone: dashboard.owner.timezone,
        ownerLocale: dashboard.owner.locale,
        ownerEmail: dashboard.owner.email,
        ownerIsAdmin: dashboard.owner.isAdmin,
        force: true,
        requestedAt: now,
        correlationId: null,
        causationId: null
      });

      enqueuedCount += 1;
    }

    logApplicationEvent({
      level: 'info',
      scope: 'dashboard-briefing',
      event: 'scheduled_dashboard_briefing_enqueue_completed',
      message: 'Scheduled dashboard audio briefing enqueue completed.',
      context: {
        enqueuedCount,
        skippedDisabledCount,
        skippedGeneratingCount,
        dashboardCount: dashboards.length
      }
    });

    return {
      enqueuedCount,
      skippedDisabledCount,
      skippedGeneratingCount
    };
  }
}
