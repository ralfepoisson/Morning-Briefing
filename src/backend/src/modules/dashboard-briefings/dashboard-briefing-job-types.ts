export type GenerateDashboardAudioBriefingRequested = {
  schemaVersion: 1;
  jobId: string;
  dashboardId: string;
  tenantId: string;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerTimezone: string;
  ownerLocale: string;
  ownerEmail: string;
  ownerIsAdmin: boolean;
  force: boolean;
  correlationId: string | null;
  causationId: string | null;
  requestedAt: string;
};

export type GenerateDashboardAudioBriefingEnvelope = {
  type: 'GenerateDashboardAudioBriefingRequested';
  payload: GenerateDashboardAudioBriefingRequested;
};
