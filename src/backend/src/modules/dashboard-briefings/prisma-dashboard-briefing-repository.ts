import type { PrismaClient } from '@prisma/client';
import type {
  DashboardBriefingAudioRecord,
  DashboardBriefingPreferenceRecord,
  DashboardBriefingRecord
} from './dashboard-briefing-types.js';
import type {
  DashboardBriefingAggregationDashboard,
  DashboardBriefingRepository,
  DashboardBriefingWidgetSnapshotSource
} from './dashboard-briefing-repository.js';

export class PrismaDashboardBriefingRepository implements DashboardBriefingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findDashboardAggregationContext(
    dashboardId: string,
    ownerUserId: string
  ): Promise<DashboardBriefingAggregationDashboard | null> {
    try {
      const dashboard = await this.prisma.dashboard.findFirst({
        where: {
          id: dashboardId,
          ownerUserId,
          archivedAt: null
        },
        select: {
          id: true,
          tenantId: true,
          ownerUserId: true,
          name: true
        }
      });

      if (!dashboard) {
        return null;
      }

      const widgets = await this.prisma.dashboardWidget.findMany({
        where: {
          dashboardId: dashboard.id,
          archivedAt: null,
          isVisible: true
        },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' }
        ],
        select: {
          id: true,
          widgetType: true,
          title: true,
          includeInBriefingOverride: true,
          snapshots: {
            orderBy: [
              { generatedAt: 'desc' },
              { id: 'desc' }
            ],
            take: 1,
            select: {
              id: true,
              widgetType: true,
              title: true,
              status: true,
              contentJson: true,
              contentHash: true,
              errorMessage: true,
              generatedAt: true
            }
          }
        }
      });

      return {
        id: dashboard.id,
        tenantId: dashboard.tenantId,
        ownerUserId: dashboard.ownerUserId,
        name: dashboard.name,
        widgets: widgets.map(function mapWidget(widget) {
          return {
            id: widget.id,
            type: widget.widgetType,
            title: widget.title,
            includeInBriefingOverride: typeof widget.includeInBriefingOverride === 'boolean'
              ? widget.includeInBriefingOverride
              : null,
            latestSnapshot: widget.snapshots.length ? mapWidgetSnapshot(widget.snapshots[0]) : null
          };
        })
      };
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      const dashboard = await this.prisma.dashboard.findFirst({
        where: {
          id: dashboardId,
          ownerUserId,
          archivedAt: null
        },
        select: {
          id: true,
          tenantId: true,
          ownerUserId: true,
          name: true
        }
      });

      if (!dashboard) {
        return null;
      }

      const widgets = await this.prisma.dashboardWidget.findMany({
        where: {
          dashboardId: dashboard.id,
          archivedAt: null,
          isVisible: true
        },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' }
        ],
        select: {
          id: true,
          widgetType: true,
          title: true,
          snapshots: {
            orderBy: [
              { generatedAt: 'desc' },
              { id: 'desc' }
            ],
            take: 1,
            select: {
              id: true,
              widgetType: true,
              title: true,
              status: true,
              contentJson: true,
              contentHash: true,
              errorMessage: true,
              generatedAt: true
            }
          }
        }
      });

      return {
        id: dashboard.id,
        tenantId: dashboard.tenantId,
        ownerUserId: dashboard.ownerUserId,
        name: dashboard.name,
        widgets: widgets.map(function mapLegacyWidget(widget) {
          return {
            id: widget.id,
            type: widget.widgetType,
            title: widget.title,
            includeInBriefingOverride: null,
            latestSnapshot: widget.snapshots.length ? mapWidgetSnapshot(widget.snapshots[0]) : null
          };
        })
      };
    }
  }

  async findPreference(dashboardId: string, ownerUserId: string): Promise<DashboardBriefingPreferenceRecord | null> {
    try {
      const preference = await this.prisma.dashboardBriefingPreference.findFirst({
        where: {
          dashboardId,
          dashboard: {
            ownerUserId,
            archivedAt: null
          }
        }
      });

      return preference ? mapPreference(preference) : null;
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      return null;
    }
  }

  async upsertPreference(input: {
    dashboardId: string;
    ownerUserId: string;
    enabled: boolean;
    autoGenerate: boolean;
    targetDurationSeconds: number;
    tone: string;
    language: string;
    voiceName: string;
    includeWidgetTypes: string[];
  }): Promise<DashboardBriefingPreferenceRecord | null> {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: {
        id: input.dashboardId,
        ownerUserId: input.ownerUserId,
        archivedAt: null
      }
    });

    if (!dashboard) {
      return null;
    }

    try {
      const preference = await this.prisma.dashboardBriefingPreference.upsert({
        where: {
          dashboardId: dashboard.id
        },
        update: {
          enabled: input.enabled,
          autoGenerate: input.autoGenerate,
          targetDurationSeconds: input.targetDurationSeconds,
          tone: input.tone,
          language: input.language,
          voiceName: input.voiceName,
          includeWidgetTypesJson: input.includeWidgetTypes
        },
        create: {
          dashboardId: dashboard.id,
          enabled: input.enabled,
          autoGenerate: input.autoGenerate,
          targetDurationSeconds: input.targetDurationSeconds,
          tone: input.tone,
          language: input.language,
          voiceName: input.voiceName,
          includeWidgetTypesJson: input.includeWidgetTypes
        }
      });

      return mapPreference(preference);
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      return null;
    }
  }

  async findLatestBriefing(dashboardId: string, ownerUserId: string): Promise<DashboardBriefingRecord | null> {
    try {
      const briefing = await this.prisma.dashboardBriefing.findFirst({
        where: {
          dashboardId,
          dashboard: {
            ownerUserId,
            archivedAt: null
          }
        },
        include: {
          audio: {
            orderBy: [
              { createdAt: 'desc' },
              { id: 'desc' }
            ],
            take: 1
          }
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' }
        ]
      });

      return briefing ? mapBriefing(briefing) : null;
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      return null;
    }
  }

  async findReusableReadyBriefing(
    dashboardId: string,
    ownerUserId: string,
    sourceSnapshotHash: string
  ): Promise<DashboardBriefingRecord | null> {
    try {
      const briefing = await this.prisma.dashboardBriefing.findFirst({
        where: {
          dashboardId,
          sourceSnapshotHash,
          status: 'READY',
          dashboard: {
            ownerUserId,
            archivedAt: null
          }
        },
        include: {
          audio: {
            orderBy: [
              { createdAt: 'desc' },
              { id: 'desc' }
            ],
            take: 1
          }
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' }
        ]
      });

      return briefing ? mapBriefing(briefing) : null;
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      return null;
    }
  }

  async createBriefing(input: {
    dashboardId: string;
    ownerUserId: string;
    status: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
    sourceSnapshotHash: string;
    modelName: string;
    promptVersion: string;
  }): Promise<DashboardBriefingRecord | null> {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: {
        id: input.dashboardId,
        ownerUserId: input.ownerUserId,
        archivedAt: null
      }
    });

    if (!dashboard) {
      return null;
    }

    try {
      const briefing = await this.prisma.dashboardBriefing.create({
        data: {
          dashboardId: dashboard.id,
          status: input.status,
          sourceSnapshotHash: input.sourceSnapshotHash,
          modelName: input.modelName,
          promptVersion: input.promptVersion
        },
        include: {
          audio: {
            orderBy: [
              { createdAt: 'desc' },
              { id: 'desc' }
            ],
            take: 1
          }
        }
      });

      return mapBriefing(briefing);
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      return null;
    }
  }

  async updateBriefing(input: {
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
  }): Promise<DashboardBriefingRecord | null> {
    let existing;

    try {
      existing = await this.prisma.dashboardBriefing.findFirst({
        where: {
          id: input.briefingId,
          dashboard: {
            ownerUserId: input.ownerUserId,
            archivedAt: null
          }
        }
      });
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      return null;
    }

    if (!existing) {
      return null;
    }

    const nextScriptJson = input.scriptJson
      ? {
        ...input.scriptJson,
        metadata: {
          ...readMetadata(input.scriptJson),
          sourceWidgetTypes: input.sourceWidgetTypes || readMetadata(input.scriptJson).sourceWidgetTypes || []
        }
      }
      : undefined;
    try {
      const briefing = await this.prisma.dashboardBriefing.update({
        where: {
          id: existing.id
        },
        data: {
          status: input.status,
          generatedAt: input.generatedAt,
          modelName: input.modelName,
          promptVersion: input.promptVersion,
          scriptText: input.scriptText,
          scriptJson: nextScriptJson,
          estimatedDurationSeconds: input.estimatedDurationSeconds,
          errorMessage: input.errorMessage
        },
        include: {
          audio: {
            orderBy: [
              { createdAt: 'desc' },
              { id: 'desc' }
            ],
            take: 1
          }
        }
      });

      return mapBriefing(briefing);
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      return null;
    }
  }

  async createAudio(input: {
    briefingId: string;
    ownerUserId: string;
    provider: string;
    voiceName: string;
    storageKey: string;
    mimeType: string;
    durationSeconds: number | null;
    generatedAt: Date | null;
  }): Promise<DashboardBriefingAudioRecord | null> {
    let briefing;

    try {
      briefing = await this.prisma.dashboardBriefing.findFirst({
        where: {
          id: input.briefingId,
          dashboard: {
            ownerUserId: input.ownerUserId,
            archivedAt: null
          }
        }
      });
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      return null;
    }

    if (!briefing) {
      return null;
    }

    try {
      const audio = await this.prisma.dashboardBriefingAudio.create({
        data: {
          dashboardBriefingId: briefing.id,
          provider: input.provider,
          voiceName: input.voiceName,
          storageKey: input.storageKey,
          mimeType: input.mimeType,
          durationSeconds: input.durationSeconds,
          generatedAt: input.generatedAt
        }
      });

      return mapAudio(audio);
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      return null;
    }
  }

  async findAudioById(audioId: string, ownerUserId: string): Promise<DashboardBriefingAudioRecord | null> {
    try {
      const audio = await this.prisma.dashboardBriefingAudio.findFirst({
        where: {
          id: audioId,
          briefing: {
            dashboard: {
              ownerUserId,
              archivedAt: null
            }
          }
        }
      });

      return audio ? mapAudio(audio) : null;
    } catch (error) {
      if (!isMissingBriefingSchemaError(error)) {
        throw error;
      }

      return null;
    }
  }
}

function mapPreference(preference: {
  id: string;
  dashboardId: string;
  enabled: boolean;
  autoGenerate: boolean;
  targetDurationSeconds: number;
  tone: string;
  language: string;
  voiceName: string;
  includeWidgetTypesJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DashboardBriefingPreferenceRecord {
  return {
    id: preference.id,
    dashboardId: preference.dashboardId,
    enabled: preference.enabled,
    autoGenerate: preference.autoGenerate,
    targetDurationSeconds: preference.targetDurationSeconds,
    tone: preference.tone,
    language: preference.language,
    voiceName: preference.voiceName,
    includeWidgetTypes: readStringArray(preference.includeWidgetTypesJson),
    createdAt: preference.createdAt,
    updatedAt: preference.updatedAt
  };
}

function mapBriefing(briefing: {
  id: string;
  dashboardId: string;
  status: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
  sourceSnapshotHash: string;
  generatedAt: Date | null;
  modelName: string;
  promptVersion: string;
  scriptText: string;
  scriptJson: unknown;
  estimatedDurationSeconds: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  audio?: Array<{
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
  }>;
}): DashboardBriefingRecord {
  const scriptJson = asObject(briefing.scriptJson);
  const metadata = readMetadata(scriptJson);

  return {
    id: briefing.id,
    dashboardId: briefing.dashboardId,
    status: briefing.status,
    sourceSnapshotHash: briefing.sourceSnapshotHash,
    generatedAt: briefing.generatedAt,
    modelName: briefing.modelName,
    promptVersion: briefing.promptVersion,
    scriptText: briefing.scriptText,
    scriptJson,
    estimatedDurationSeconds: briefing.estimatedDurationSeconds,
    errorMessage: briefing.errorMessage,
    sourceWidgetTypes: Array.isArray(metadata.sourceWidgetTypes) ? metadata.sourceWidgetTypes : [],
    createdAt: briefing.createdAt,
    updatedAt: briefing.updatedAt,
    audio: briefing.audio && briefing.audio.length ? mapAudio(briefing.audio[0]) : null
  };
}

function mapAudio(audio: {
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
}): DashboardBriefingAudioRecord {
  return {
    id: audio.id,
    dashboardBriefingId: audio.dashboardBriefingId,
    provider: audio.provider,
    voiceName: audio.voiceName,
    storageKey: audio.storageKey,
    mimeType: audio.mimeType,
    durationSeconds: audio.durationSeconds,
    generatedAt: audio.generatedAt,
    createdAt: audio.createdAt,
    updatedAt: audio.updatedAt
  };
}

function mapWidgetSnapshot(snapshot: {
  id: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  contentJson: unknown;
  contentHash: string | null;
  generatedAt: Date;
  errorMessage: string | null;
}): DashboardBriefingWidgetSnapshotSource {
  return {
    id: snapshot.id,
    status: snapshot.status,
    content: asObject(snapshot.contentJson),
    contentHash: snapshot.contentHash || '',
    generatedAt: snapshot.generatedAt,
    errorMessage: snapshot.errorMessage
  };
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(function filterValue(item): item is string {
      return typeof item === 'string' && item.trim().length > 0;
    }).map(function trimValue(item) {
      return item.trim();
    })
    : [];
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readMetadata(value: Record<string, unknown>): {
  sourceWidgetTypes?: string[];
} {
  const metadata = asObject(value.metadata);
  const sourceWidgetTypes = readStringArray(metadata.sourceWidgetTypes);

  return sourceWidgetTypes.length ? { sourceWidgetTypes } : {};
}

function isMissingBriefingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
  };
  const message = typeof candidate.message === 'string' ? candidate.message : '';

  return candidate.code === 'P2021'
    || candidate.code === 'P2022'
    || message.includes('dashboard_briefing_')
    || message.includes('include_in_briefing_override');
}
