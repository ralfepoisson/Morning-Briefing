import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardBriefingAggregationService } from './dashboard-briefing-aggregation-service.js';

test('DashboardBriefingAggregationService builds structured input from eligible ready snapshots', async function () {
  const service = new DashboardBriefingAggregationService({
    async findDashboardAggregationContext() {
      return {
        id: 'dash-1',
        ownerUserId: 'user-1',
        name: 'Morning Briefing',
        widgets: [
          {
            id: 'weather-1',
            type: 'weather',
            title: 'Weather Outlook',
            includeInBriefingOverride: null,
            latestSnapshot: {
              id: 'snap-weather',
              status: 'READY',
              contentHash: 'hash-weather',
              generatedAt: new Date('2026-03-25T06:00:00.000Z'),
              errorMessage: null,
              content: {
                location: 'Mulhouse, FR',
                condition: 'Partly sunny',
                summary: 'A dry and bright start with a mild afternoon.',
                details: [{ label: 'Rain', value: '10%' }]
              }
            }
          },
          {
            id: 'xkcd-1',
            type: 'xkcd',
            title: 'Latest xkcd',
            includeInBriefingOverride: null,
            latestSnapshot: {
              id: 'snap-xkcd',
              status: 'READY',
              contentHash: 'hash-xkcd',
              generatedAt: new Date('2026-03-25T06:00:00.000Z'),
              errorMessage: null,
              content: {
                title: 'A comic'
              }
            }
          },
          {
            id: 'tasks-1',
            type: 'tasks',
            title: 'Task List',
            includeInBriefingOverride: true,
            latestSnapshot: {
              id: 'snap-tasks',
              status: 'READY',
              contentHash: 'hash-tasks',
              generatedAt: new Date('2026-03-25T06:00:00.000Z'),
              errorMessage: null,
              content: {
                groups: [
                  {
                    label: 'Due Today',
                    items: [{ title: 'Draft project update', meta: 'today' }]
                  }
                ]
              }
            }
          },
          {
            id: 'calendar-1',
            type: 'calendar',
            title: 'Today on Calendar',
            includeInBriefingOverride: null,
            latestSnapshot: null
          }
        ]
      };
    }
  });

  const result = await service.buildInput('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris',
    locale: 'en-GB',
    email: 'ralfe@example.com',
    isAdmin: true
  }, {
    id: 'pref-1',
    dashboardId: 'dash-1',
    enabled: true,
    autoGenerate: false,
    targetDurationSeconds: 75,
    tone: 'calm, concise, professional',
    language: 'en-GB',
    voiceName: 'default',
    includeWidgetTypes: [],
    createdAt: new Date('2026-03-25T05:00:00.000Z'),
    updatedAt: new Date('2026-03-25T05:00:00.000Z')
  });

  assert.ok(result);
  assert.equal(result.input.sections.length, 2);
  assert.deepEqual(result.includedWidgetTypes, ['weather', 'tasks']);
  assert.equal(result.input.sections[0].widgetType, 'weather');
  assert.equal(result.input.sections[1].widgetType, 'tasks');
  assert.ok(result.sourceSnapshotHash);
  assert.deepEqual(result.skippedWidgets, [
    { widgetId: 'xkcd-1', reason: 'not_included' },
    { widgetId: 'calendar-1', reason: 'missing_or_unready_snapshot' }
  ]);
});
