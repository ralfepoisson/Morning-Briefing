import type { GenerateDashboardAudioBriefingRequested } from './dashboard-briefing-job-types.js';

export type PublishDashboardAudioBriefingJobInput = {
  dashboardId: string;
  tenantId: string;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerPhoneticName: string | null;
  ownerTimezone: string;
  ownerLocale: string;
  ownerEmail: string;
  ownerIsAdmin: boolean;
  force: boolean;
  correlationId?: string | null;
  causationId?: string | null;
  requestedAt?: Date;
};

export interface DashboardBriefingJobPublisher {
  publishGenerateDashboardAudioBriefing(
    input: PublishDashboardAudioBriefingJobInput
  ): Promise<GenerateDashboardAudioBriefingRequested>;
}
