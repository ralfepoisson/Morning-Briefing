import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardBriefingService } from './dashboard-briefing-service.js';
import type { DashboardBriefingRepository } from './dashboard-briefing-repository.js';

test('DashboardBriefingService reuses latest ready briefing when source hash is unchanged', async function () {
  const calls = {
    createBriefing: 0,
    synthesize: 0,
    generating: []
  };
  const repository = createRepository();
  const service = new DashboardBriefingService(
    repository,
    {
      async buildInput() {
        return {
          input: {
            tenantId: 'tenant-1',
            dashboardId: 'dash-1',
            dashboardName: 'Morning Briefing',
            generatedAt: '2026-03-25T06:00:00.000Z',
            language: 'en-GB',
            tone: 'calm, concise, professional',
            targetDurationSeconds: 75,
            sections: [
              {
                widgetId: 'weather-1',
                widgetType: 'weather',
                title: 'Weather Outlook',
                importance: 'high',
                content: {
                  summary: 'Sunny'
                }
              }
            ]
          },
          sourceSnapshotHash: 'same-hash',
          includedWidgetTypes: ['weather'],
          skippedWidgets: []
        };
      }
    },
    {
      getModelName() {
        return 'stub-template';
      },
      async generateScript() {
        throw new Error('should not generate');
      }
    },
    {
      getProviderName() {
        return 'stub-wave';
      },
      async generateAndStore() {
        calls.synthesize += 1;
        throw new Error('should not synthesize');
      },
      resolveStoragePath(storageKey) {
        return storageKey;
      }
    }
  );

  repository.findReusableReadyBriefing = async function findReusableReadyBriefing() {
    return createBriefingRecord();
  };
  repository.createBriefing = async function createBriefing() {
    calls.createBriefing += 1;
    return createBriefingRecord();
  };

  const result = await service.generateBriefing('dash-1', createUser(), {});

  assert.equal(result && result.reused, true);
  assert.equal(calls.createBriefing, 0);
  assert.equal(calls.synthesize, 0);
  assert.deepEqual(calls.generating, []);
});

test('DashboardBriefingService toggles dashboard generating state around fresh generation', async function () {
  const calls = {
    generating: []
  } as {
    generating: Array<{ dashboardId: string; ownerUserId: string; isGenerating: boolean }>;
  };
  const repository = createRepository(calls);
  const service = new DashboardBriefingService(
    repository,
    {
      async buildInput() {
        return {
          input: {
            tenantId: 'tenant-1',
            dashboardId: 'dash-1',
            dashboardName: 'Morning Briefing',
            generatedAt: '2026-03-25T06:00:00.000Z',
            language: 'en-GB',
            tone: 'calm, concise, professional',
            targetDurationSeconds: 75,
            sections: [
              {
                widgetId: 'weather-1',
                widgetType: 'weather',
                title: 'Weather Outlook',
                importance: 'high',
                content: {
                  summary: 'Sunny'
                }
              }
            ]
          },
          sourceSnapshotHash: 'fresh-hash',
          includedWidgetTypes: ['weather'],
          skippedWidgets: []
        };
      }
    },
    {
      getModelName() {
        return 'stub-template';
      },
      async generateScript() {
        return {
          title: 'Morning Briefing',
          estimatedDurationSeconds: 60,
          fullScript: 'Sunny today.'
        };
      }
    },
    {
      getProviderName() {
        return 'stub-wave';
      },
      async generateAndStore() {
        return {
          provider: 'stub-wave',
          voiceName: 'default',
          storageKey: 'audio-briefings/briefing-1/audio-1.wav',
          mimeType: 'audio/wav',
          durationSeconds: 60,
          generatedAt: new Date('2026-03-25T06:05:00.000Z')
        };
      },
      resolveStoragePath(storageKey) {
        return storageKey;
      }
    }
  );

  await service.generateBriefing('dash-1', createUser(), { force: true });

  assert.deepEqual(calls.generating, [
    { dashboardId: 'dash-1', ownerUserId: 'user-1', isGenerating: true },
    { dashboardId: 'dash-1', ownerUserId: 'user-1', isGenerating: false }
  ]);
});

function createRepository(calls = { generating: [] as Array<{ dashboardId: string; ownerUserId: string; isGenerating: boolean }> }): DashboardBriefingRepository {
  return {
    async findDashboardAggregationContext() {
      return {
        id: 'dash-1',
        tenantId: 'tenant-1',
        ownerUserId: 'user-1',
        name: 'Morning Briefing',
        widgets: []
      };
    },
    async setDashboardGenerating(dashboardId: string, ownerUserId: string, isGenerating: boolean) {
      calls.generating.push({ dashboardId, ownerUserId, isGenerating });
    },
    async findPreference() {
      return null;
    },
    async upsertPreference() {
      return null;
    },
    async findLatestBriefing() {
      return null;
    },
    async findReusableReadyBriefing() {
      return null;
    },
    async createBriefing() {
      return null;
    },
    async updateBriefing() {
      return null;
    },
    async createAudio() {
      return null;
    },
    async findAudioById() {
      return null;
    }
  };
}

function createBriefingRecord() {
  return {
    id: 'briefing-1',
    dashboardId: 'dash-1',
    status: 'READY' as const,
    sourceSnapshotHash: 'same-hash',
    generatedAt: new Date('2026-03-25T06:05:00.000Z'),
    modelName: 'stub-template',
    promptVersion: 'dashboard-briefing-v1',
    scriptText: 'Good morning.',
    scriptJson: {},
    estimatedDurationSeconds: 60,
    errorMessage: null,
    sourceWidgetTypes: ['weather'],
    createdAt: new Date('2026-03-25T06:05:00.000Z'),
    updatedAt: new Date('2026-03-25T06:05:00.000Z'),
    audio: {
      id: 'audio-1',
      dashboardBriefingId: 'briefing-1',
      provider: 'stub-wave',
      voiceName: 'default',
      storageKey: 'audio-briefings/briefing-1/audio-1.wav',
      mimeType: 'audio/wav',
      durationSeconds: 60,
      generatedAt: new Date('2026-03-25T06:05:00.000Z'),
      createdAt: new Date('2026-03-25T06:05:00.000Z'),
      updatedAt: new Date('2026-03-25T06:05:00.000Z')
    }
  };
}

function createUser() {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris',
    locale: 'en-GB',
    email: 'ralfe@example.com',
    isAdmin: true
  };
}
