import type {
  DashboardBriefingAudioRecord,
  DashboardBriefingPreferenceRecord,
  DashboardBriefingRecord
} from './dashboard-briefing-types.js';

export type DashboardBriefingWidgetSnapshotSource = {
  id: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  content: Record<string, unknown>;
  contentHash: string;
  generatedAt: Date;
  errorMessage: string | null;
};

export type DashboardBriefingAggregationDashboard = {
  id: string;
  ownerUserId: string;
  name: string;
  widgets: Array<{
    id: string;
    type: string;
    title: string;
    includeInBriefingOverride: boolean | null;
    latestSnapshot: DashboardBriefingWidgetSnapshotSource | null;
  }>;
};

export interface DashboardBriefingAggregationRepository {
  findDashboardAggregationContext(
    dashboardId: string,
    ownerUserId: string
  ): Promise<DashboardBriefingAggregationDashboard | null>;
}

export interface DashboardBriefingRepository extends DashboardBriefingAggregationRepository {
  findPreference(dashboardId: string, ownerUserId: string): Promise<DashboardBriefingPreferenceRecord | null>;
  upsertPreference(input: {
    dashboardId: string;
    ownerUserId: string;
    enabled: boolean;
    autoGenerate: boolean;
    targetDurationSeconds: number;
    tone: string;
    language: string;
    voiceName: string;
    includeWidgetTypes: string[];
  }): Promise<DashboardBriefingPreferenceRecord | null>;
  findLatestBriefing(dashboardId: string, ownerUserId: string): Promise<DashboardBriefingRecord | null>;
  findReusableReadyBriefing(
    dashboardId: string,
    ownerUserId: string,
    sourceSnapshotHash: string
  ): Promise<DashboardBriefingRecord | null>;
  createBriefing(input: {
    dashboardId: string;
    ownerUserId: string;
    status: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
    sourceSnapshotHash: string;
    modelName: string;
    promptVersion: string;
  }): Promise<DashboardBriefingRecord | null>;
  updateBriefing(input: {
    briefingId: string;
    ownerUserId: string;
    status: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
    generatedAt?: Date | null;
    modelName?: string;
    promptVersion?: string;
    scriptText?: string;
    scriptJson?: Record<string, unknown>;
    estimatedDurationSeconds?: number | null;
    errorMessage?: string | null;
    sourceWidgetTypes?: string[];
  }): Promise<DashboardBriefingRecord | null>;
  createAudio(input: {
    briefingId: string;
    ownerUserId: string;
    provider: string;
    voiceName: string;
    storageKey: string;
    mimeType: string;
    durationSeconds: number | null;
    generatedAt: Date | null;
  }): Promise<DashboardBriefingAudioRecord | null>;
  findAudioById(audioId: string, ownerUserId: string): Promise<DashboardBriefingAudioRecord | null>;
}
