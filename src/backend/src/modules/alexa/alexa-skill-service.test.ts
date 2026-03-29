import test from 'node:test';
import assert from 'node:assert/strict';
import { AlexaSkillService } from './alexa-skill-service.js';

test('AlexaSkillService returns the latest ready briefing from the default dashboard', async function () {
  const service = new AlexaSkillService(
    {
      async listForOwner(ownerUserId) {
        assert.equal(ownerUserId, 'user-1');
        return [
          {
            id: 'dash-default',
            name: 'Workday',
            description: '',
            theme: 'aurora',
            isGenerating: false,
            createdAt: '2026-03-28T05:00:00.000Z',
            updatedAt: '2026-03-28T05:00:00.000Z'
          }
        ];
      }
    },
    {
      async getLatestBriefing(dashboardId, user) {
        assert.equal(dashboardId, 'dash-default');
        assert.equal(user.userId, 'user-1');
        return {
          id: 'briefing-1',
          dashboardId: 'dash-default',
          status: 'READY',
          sourceSnapshotHash: 'hash-1',
          generatedAt: '2026-03-29T05:30:00.000Z',
          modelName: 'gpt-5-mini',
          promptVersion: 'v1',
          scriptText: 'Good morning. Here is your daily briefing.',
          scriptJson: {},
          estimatedDurationSeconds: 65,
          errorMessage: null,
          sourceWidgetTypes: ['weather'],
          createdAt: '2026-03-29T05:30:00.000Z',
          updatedAt: '2026-03-29T05:30:00.000Z',
          audio: null
        };
      }
    }
  );

  const result = await service.getDailyBriefing({
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris',
    locale: 'en-GB',
    preferredLanguage: 'en-GB',
    email: 'ralfe@example.com',
    isAdmin: true
  });

  assert.deepEqual(result, {
    status: 'ready',
    dashboardId: 'dash-default',
    dashboardName: 'Workday',
    briefingId: 'briefing-1',
    generatedAt: '2026-03-29T05:30:00.000Z',
    scriptText: 'Good morning. Here is your daily briefing.'
  });
});

test('AlexaSkillService returns missing_dashboard when the user has no dashboards', async function () {
  const service = new AlexaSkillService(
    {
      async listForOwner() {
        return [];
      }
    },
    {
      async getLatestBriefing() {
        throw new Error('not used');
      }
    }
  );

  const result = await service.getDailyBriefing({
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris',
    locale: 'en-GB',
    preferredLanguage: 'en-GB',
    email: 'ralfe@example.com',
    isAdmin: true
  });

  assert.deepEqual(result, {
    status: 'missing_dashboard'
  });
});

test('AlexaSkillService returns missing_briefing when no ready briefing is available yet', async function () {
  const service = new AlexaSkillService(
    {
      async listForOwner() {
        return [
          {
            id: 'dash-default',
            name: 'Workday',
            description: '',
            theme: 'aurora',
            isGenerating: false,
            createdAt: '2026-03-28T05:00:00.000Z',
            updatedAt: '2026-03-28T05:00:00.000Z'
          }
        ];
      }
    },
    {
      async getLatestBriefing() {
        return {
          id: 'briefing-1',
          dashboardId: 'dash-default',
          status: 'GENERATING',
          sourceSnapshotHash: 'hash-1',
          generatedAt: null,
          modelName: 'gpt-5-mini',
          promptVersion: 'v1',
          scriptText: '',
          scriptJson: {},
          estimatedDurationSeconds: null,
          errorMessage: null,
          sourceWidgetTypes: ['weather'],
          createdAt: '2026-03-29T05:30:00.000Z',
          updatedAt: '2026-03-29T05:30:00.000Z',
          audio: null
        };
      }
    }
  );

  const result = await service.getDailyBriefing({
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris',
    locale: 'en-GB',
    preferredLanguage: 'en-GB',
    email: 'ralfe@example.com',
    isAdmin: true
  });

  assert.deepEqual(result, {
    status: 'missing_briefing',
    dashboardId: 'dash-default',
    dashboardName: 'Workday'
  });
});
