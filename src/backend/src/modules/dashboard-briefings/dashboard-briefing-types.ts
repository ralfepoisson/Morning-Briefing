export type DashboardBriefingPreferenceRecord = {
  id: string;
  dashboardId: string;
  enabled: boolean;
  autoGenerate: boolean;
  targetDurationSeconds: number;
  tone: string;
  language: string;
  voiceName: string;
  includeWidgetTypes: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type DashboardBriefingAudioRecord = {
  id: string;
  dashboardBriefingId: string;
  provider: string;
  voiceName: string;
  storageKey: string;
  mimeType: string;
  durationSeconds: number | null;
  generatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DashboardBriefingRecord = {
  id: string;
  dashboardId: string;
  status: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
  sourceSnapshotHash: string;
  generatedAt: Date | null;
  modelName: string;
  promptVersion: string;
  scriptText: string;
  scriptJson: Record<string, unknown>;
  estimatedDurationSeconds: number | null;
  errorMessage: string | null;
  sourceWidgetTypes: string[];
  createdAt: Date;
  updatedAt: Date;
  audio: DashboardBriefingAudioRecord | null;
};

export type DashboardBriefingPreferenceResponse = {
  id: string | null;
  dashboardId: string;
  enabled: boolean;
  autoGenerate: boolean;
  targetDurationSeconds: number;
  tone: string;
  language: string;
  voiceName: string;
  includeWidgetTypes: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type DashboardBriefingAudioResponse = {
  id: string;
  provider: string;
  voiceName: string;
  mimeType: string;
  durationSeconds: number | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  playbackUrl: string;
};

export type DashboardBriefingResponse = {
  id: string;
  dashboardId: string;
  status: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
  sourceSnapshotHash: string;
  generatedAt: string | null;
  modelName: string;
  promptVersion: string;
  scriptText: string;
  scriptJson: Record<string, unknown>;
  estimatedDurationSeconds: number | null;
  errorMessage: string | null;
  sourceWidgetTypes: string[];
  createdAt: string;
  updatedAt: string;
  audio: DashboardBriefingAudioResponse | null;
};

export type DashboardBriefingSectionInput = {
  widgetId: string;
  widgetType: string;
  title: string;
  importance: 'high' | 'medium' | 'low';
  content: Record<string, unknown>;
};

export type DashboardBriefingInput = {
  tenantId: string;
  dashboardId: string;
  dashboardName: string;
  generatedAt: string;
  language: string;
  preferredLanguage: string;
  tone: string;
  targetDurationSeconds: number;
  listener: {
    greetingName: string | null;
  };
  sections: DashboardBriefingSectionInput[];
};

export type DashboardBriefingScript = {
  title: string;
  estimatedDurationSeconds: number;
  fullScript: string;
};

export type DashboardBriefingGenerationResult = {
  briefing: DashboardBriefingResponse;
  reused: boolean;
};
