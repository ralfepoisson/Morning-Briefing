import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { logApplicationEvent, toLogErrorContext } from '../admin/application-logger.js';
import type { DefaultUserContext } from '../default-user/default-user-service.js';
import { DashboardBriefingAggregationService } from './dashboard-briefing-aggregation-service.js';
import type { DashboardBriefingDeliveryService } from './dashboard-briefing-delivery-service.js';
import { DASHBOARD_BRIEFING_PROMPT_VERSION } from './dashboard-briefing-prompt-service.js';
import type {
  DashboardBriefingAudioResponse,
  DashboardBriefingGenerationResult,
  DashboardBriefingPreferenceRecord,
  DashboardBriefingPreferenceResponse,
  DashboardBriefingResponse
} from './dashboard-briefing-types.js';
import type { DashboardBriefingRepository } from './dashboard-briefing-repository.js';
import { DashboardBriefingLlmService } from './dashboard-briefing-llm-service.js';
import { DashboardBriefingTtsService } from './dashboard-briefing-tts-service.js';

export class DashboardBriefingService {
  constructor(
    private readonly repository: DashboardBriefingRepository,
    private readonly aggregationService: DashboardBriefingAggregationService,
    private readonly llmService: DashboardBriefingLlmService,
    private readonly ttsService: DashboardBriefingTtsService,
    private readonly deliveryService: Pick<DashboardBriefingDeliveryService, 'deliverGeneratedAudio'>
  ) {}

  async getPreferences(dashboardId: string, user: DefaultUserContext): Promise<DashboardBriefingPreferenceResponse | null> {
    const dashboard = await this.repository.findDashboardAggregationContext(dashboardId, user.userId);

    if (!dashboard) {
      return null;
    }

    const preference = await this.repository.findPreference(dashboardId, user.userId);
    return toPreferenceResponse(preference || buildDefaultPreference(dashboardId, user));
  }

  async updatePreferences(
    dashboardId: string,
    user: DefaultUserContext,
    input: Partial<{
      enabled: boolean;
      autoGenerate: boolean;
      targetDurationSeconds: number;
      tone: string;
      language: string;
      voiceName: string;
      includeWidgetTypes: string[];
    }>
  ): Promise<DashboardBriefingPreferenceResponse | null> {
    const current = await this.repository.findPreference(dashboardId, user.userId) || buildDefaultPreference(dashboardId, user);
    const saved = await this.repository.upsertPreference({
      dashboardId,
      ownerUserId: user.userId,
      enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
      autoGenerate: typeof input.autoGenerate === 'boolean' ? input.autoGenerate : current.autoGenerate,
      targetDurationSeconds: normalizeDuration(input.targetDurationSeconds, current.targetDurationSeconds),
      tone: normalizeTone(input.tone || current.tone),
      language: normalizeLanguage(input.language || current.language),
      voiceName: normalizeVoice(input.voiceName || current.voiceName),
      includeWidgetTypes: Array.isArray(input.includeWidgetTypes)
        ? input.includeWidgetTypes.filter(function filterType(item): item is string {
          return typeof item === 'string' && item.trim().length > 0;
        }).map(function trimType(item) {
          return item.trim();
        })
        : current.includeWidgetTypes
    });

    return saved ? toPreferenceResponse(saved) : null;
  }

  async previewInput(dashboardId: string, user: DefaultUserContext) {
    const preferences = await this.repository.findPreference(dashboardId, user.userId) || buildDefaultPreference(dashboardId, user);
    return this.aggregationService.buildInput(dashboardId, user, preferences);
  }

  async getLatestBriefing(dashboardId: string, user: DefaultUserContext): Promise<DashboardBriefingResponse | null | undefined> {
    const dashboard = await this.repository.findDashboardAggregationContext(dashboardId, user.userId);

    if (!dashboard) {
      return null;
    }

    const briefing = await this.repository.findLatestBriefing(dashboardId, user.userId);
    return briefing ? toBriefingResponse(briefing) : undefined;
  }

  async generateBriefing(
    dashboardId: string,
    user: DefaultUserContext,
    options: {
      force?: boolean;
      jobId?: string;
    } = {}
  ): Promise<DashboardBriefingGenerationResult | null> {
    logApplicationEvent({
      level: 'info',
      scope: 'dashboard-briefing',
      event: 'dashboard_briefing_generation_requested',
      message: 'Dashboard briefing generation requested.',
        context: {
          dashboardId,
          ownerUserId: user.userId,
          force: !!options.force,
          jobId: options.jobId || null
        }
      });
    const preferences = await this.repository.findPreference(dashboardId, user.userId) || buildDefaultPreference(dashboardId, user);

    if (!preferences.enabled) {
      throw new Error('Audio Briefing is disabled for this dashboard.');
    }

    const aggregation = await this.aggregationService.buildInput(dashboardId, user, preferences);

    if (!aggregation) {
      return null;
    }

    if (!aggregation.input.sections.length) {
      logApplicationEvent({
        level: 'warn',
        scope: 'dashboard-briefing',
        event: 'dashboard_briefing_generation_skipped',
        message: 'Dashboard briefing generation skipped because no eligible sections were available.',
        context: {
          dashboardId,
          ownerUserId: user.userId,
          skippedWidgets: aggregation.skippedWidgets
        }
      });
      throw new Error('No eligible widget snapshots are ready for an audio briefing yet.');
    }

    if (!options.force) {
      const reusable = await this.repository.findReusableReadyBriefing(dashboardId, user.userId, aggregation.sourceSnapshotHash);

      if (reusable && reusable.audio) {
        logApplicationEvent({
          level: 'info',
          scope: 'dashboard-briefing',
          event: 'dashboard_briefing_reused',
          message: 'Reusing the latest matching dashboard briefing.',
          context: {
            dashboardId,
            ownerUserId: user.userId,
            briefingId: reusable.id,
            audioId: reusable.audio.id,
            sourceSnapshotHash: aggregation.sourceSnapshotHash
          }
        });
        return {
          briefing: toBriefingResponse(reusable),
          reused: true
        };
      }
    } else {
      logApplicationEvent({
        level: 'info',
        scope: 'dashboard-briefing',
        event: 'dashboard_briefing_force_regeneration_requested',
        message: 'Dashboard briefing force regeneration requested.',
        context: {
          dashboardId,
          ownerUserId: user.userId,
          sourceSnapshotHash: aggregation.sourceSnapshotHash,
          jobId: options.jobId || null
        }
      });
    }

    let created: Awaited<ReturnType<DashboardBriefingRepository['createBriefing']>> | null = null;

    try {
      await this.repository.setDashboardGenerating(dashboardId, user.userId, true);

      created = await this.repository.createBriefing({
        dashboardId,
        ownerUserId: user.userId,
        status: 'GENERATING',
        sourceSnapshotHash: aggregation.sourceSnapshotHash,
        modelName: this.llmService.getModelName(),
        promptVersion: DASHBOARD_BRIEFING_PROMPT_VERSION
      });

      if (!created) {
        return null;
      }

      logApplicationEvent({
        level: 'info',
        scope: 'dashboard-briefing',
        event: 'dashboard_briefing_record_created',
        message: 'Dashboard briefing record created.',
        context: {
          dashboardId,
          ownerUserId: user.userId,
          briefingId: created.id,
          modelName: this.llmService.getModelName(),
          sourceSnapshotHash: aggregation.sourceSnapshotHash,
          jobId: options.jobId || null
        }
      });

      const script = await this.llmService.generateScript(aggregation.input);
      logApplicationEvent({
        level: 'info',
        scope: 'dashboard-briefing',
        event: 'dashboard_briefing_script_ready',
        message: 'Dashboard briefing script is ready for audio synthesis.',
        context: {
          dashboardId,
          ownerUserId: user.userId,
          briefingId: created.id,
          estimatedDurationSeconds: script.estimatedDurationSeconds,
          scriptCharacterCount: script.fullScript.length,
          jobId: options.jobId || null
        }
      });
      const audio = await this.ttsService.generateAndStore({
        briefingId: created.id,
        script: script.fullScript,
        voiceName: preferences.voiceName,
        targetDurationSeconds: script.estimatedDurationSeconds
      });
      await this.repository.createAudio({
        briefingId: created.id,
        ownerUserId: user.userId,
        provider: audio.provider,
        voiceName: audio.voiceName,
        storageKey: audio.storageKey,
        mimeType: audio.mimeType,
        durationSeconds: audio.durationSeconds,
        generatedAt: audio.generatedAt
      });
      logApplicationEvent({
        level: 'info',
        scope: 'dashboard-briefing',
        event: 'dashboard_briefing_audio_saved',
        message: 'Dashboard briefing audio metadata saved.',
        context: {
          dashboardId,
          ownerUserId: user.userId,
          briefingId: created.id,
          provider: audio.provider,
          voiceName: audio.voiceName,
          storageKey: audio.storageKey,
          jobId: options.jobId || null
        }
      });
      const updated = await this.repository.updateBriefing({
        briefingId: created.id,
        ownerUserId: user.userId,
        status: 'READY',
        generatedAt: audio.generatedAt,
        modelName: this.llmService.getModelName(),
        promptVersion: DASHBOARD_BRIEFING_PROMPT_VERSION,
        scriptText: script.fullScript,
        scriptJson: {
          title: script.title,
          estimatedDurationSeconds: script.estimatedDurationSeconds,
          fullScript: script.fullScript
        },
        estimatedDurationSeconds: script.estimatedDurationSeconds,
        errorMessage: null,
        sourceWidgetTypes: aggregation.includedWidgetTypes
      });

      if (!updated) {
        throw new Error('Audio Briefing could not be saved.');
      }

      logApplicationEvent({
        level: 'info',
        scope: 'dashboard-briefing',
        event: 'dashboard_briefing_ready',
        message: 'Dashboard audio briefing generated successfully.',
        context: {
          dashboardId,
          briefingId: created.id,
          widgetTypes: aggregation.includedWidgetTypes,
          sourceSnapshotHash: aggregation.sourceSnapshotHash,
          jobId: options.jobId || null
        }
      });

      try {
        await this.deliveryService.deliverGeneratedAudio({
          user,
          briefing: toBriefingResponse(updated),
          audio: updated.audio ? toAudioResponse(updated.audio) : null,
          storagePath: this.ttsService.resolveStoragePath(audio.storageKey),
          deliveryContext: {
            jobId: options.jobId || null
          }
        });
      } catch (deliveryError) {
        logApplicationEvent({
          level: 'warn',
          scope: 'dashboard-briefing',
          event: 'dashboard_briefing_delivery_failed',
          message: deliveryError instanceof Error ? deliveryError.message : 'Dashboard briefing delivery failed.',
          context: {
            dashboardId,
            briefingId: created.id,
            ownerUserId: user.userId,
            jobId: options.jobId || null,
            ...toLogErrorContext(deliveryError)
          }
        });
      }

      return {
        briefing: toBriefingResponse(updated),
        reused: false
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dashboard briefing generation failed.';

      if (created) {
        await this.repository.updateBriefing({
          briefingId: created.id,
          ownerUserId: user.userId,
          status: 'FAILED',
          generatedAt: new Date(),
          modelName: this.llmService.getModelName(),
          promptVersion: DASHBOARD_BRIEFING_PROMPT_VERSION,
          errorMessage: message,
          sourceWidgetTypes: aggregation.includedWidgetTypes
        });
      }
      logApplicationEvent({
        level: 'error',
        scope: 'dashboard-briefing',
        event: 'dashboard_briefing_failed',
        message,
        context: {
          dashboardId,
          briefingId: created ? created.id : null,
          widgetTypes: aggregation.includedWidgetTypes,
          sourceSnapshotHash: aggregation.sourceSnapshotHash,
          jobId: options.jobId || null,
          ...toLogErrorContext(error)
        }
      });
      throw error;
    } finally {
      await this.repository.setDashboardGenerating(dashboardId, user.userId, false);
    }
  }

  async getAudioMetadata(audioId: string, user: DefaultUserContext): Promise<DashboardBriefingAudioResponse | null> {
    const audio = await this.repository.findAudioById(audioId, user.userId);
    return audio ? toAudioResponse(audio) : null;
  }

  async getAudioContent(audioId: string, user: DefaultUserContext): Promise<{
    mimeType: string;
    content: Buffer;
  } | null> {
    logApplicationEvent({
      level: 'info',
      scope: 'dashboard-briefing',
      event: 'dashboard_briefing_audio_content_requested',
      message: 'Dashboard briefing audio content requested.',
      context: {
        audioId,
        ownerUserId: user.userId
      }
    });
    const audio = await this.repository.findAudioById(audioId, user.userId);

    if (!audio) {
      return null;
    }

    const storagePath = this.ttsService.resolveStoragePath(audio.storageKey);

    await access(storagePath, fsConstants.R_OK);

    logApplicationEvent({
      level: 'info',
      scope: 'dashboard-briefing',
      event: 'dashboard_briefing_audio_content_served',
      message: 'Dashboard briefing audio content loaded from storage.',
      context: {
        audioId,
        ownerUserId: user.userId,
        storageKey: audio.storageKey,
        mimeType: audio.mimeType
      }
    });

    return {
      mimeType: audio.mimeType,
      content: await readFile(storagePath)
    };
  }
}

function buildDefaultPreference(dashboardId: string, user: DefaultUserContext): DashboardBriefingPreferenceRecord {
  return {
    id: '',
    dashboardId,
    enabled: true,
    autoGenerate: false,
    targetDurationSeconds: 75,
    tone: 'calm, concise, professional',
    language: user.preferredLanguage || user.locale || 'en-GB',
    voiceName: 'default',
    includeWidgetTypes: [],
    createdAt: new Date(0),
    updatedAt: new Date(0)
  };
}

function normalizeDuration(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(30, Math.min(180, Math.round(value)));
}

function normalizeTone(value: string): string {
  return value.trim() || 'calm, concise, professional';
}

function normalizeLanguage(value: string): string {
  return value.trim() || 'en-GB';
}

function normalizeVoice(value: string): string {
  return value.trim() || 'default';
}

function toPreferenceResponse(preference: DashboardBriefingPreferenceRecord): DashboardBriefingPreferenceResponse {
  return {
    id: preference.id || null,
    dashboardId: preference.dashboardId,
    enabled: preference.enabled,
    autoGenerate: preference.autoGenerate,
    targetDurationSeconds: preference.targetDurationSeconds,
    tone: preference.tone,
    language: preference.language,
    voiceName: preference.voiceName,
    includeWidgetTypes: preference.includeWidgetTypes,
    createdAt: preference.id ? preference.createdAt.toISOString() : null,
    updatedAt: preference.id ? preference.updatedAt.toISOString() : null
  };
}

function toBriefingResponse(briefing: {
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
  audio: {
    id: string;
    provider: string;
    voiceName: string;
    mimeType: string;
    durationSeconds: number | null;
    generatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}): DashboardBriefingResponse {
  return {
    id: briefing.id,
    dashboardId: briefing.dashboardId,
    status: briefing.status,
    sourceSnapshotHash: briefing.sourceSnapshotHash,
    generatedAt: briefing.generatedAt ? briefing.generatedAt.toISOString() : null,
    modelName: briefing.modelName,
    promptVersion: briefing.promptVersion,
    scriptText: briefing.scriptText,
    scriptJson: briefing.scriptJson,
    estimatedDurationSeconds: briefing.estimatedDurationSeconds,
    errorMessage: briefing.errorMessage,
    sourceWidgetTypes: briefing.sourceWidgetTypes,
    createdAt: briefing.createdAt.toISOString(),
    updatedAt: briefing.updatedAt.toISOString(),
    audio: briefing.audio ? toAudioResponse(briefing.audio) : null
  };
}

function toAudioResponse(audio: {
  id: string;
  provider: string;
  voiceName: string;
  mimeType: string;
  durationSeconds: number | null;
  generatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): DashboardBriefingAudioResponse {
  return {
    id: audio.id,
    provider: audio.provider,
    voiceName: audio.voiceName,
    mimeType: audio.mimeType,
    durationSeconds: audio.durationSeconds,
    generatedAt: audio.generatedAt ? audio.generatedAt.toISOString() : null,
    createdAt: audio.createdAt.toISOString(),
    updatedAt: audio.updatedAt.toISOString(),
    playbackUrl: `/api/v1/dashboard-briefing-audio/${audio.id}/content`
  };
}
