import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardBriefingJobProcessor } from './dashboard-briefing-job-processor.js';

test('DashboardBriefingJobProcessor regenerates audio as the dashboard owner', async function () {
  let received = null;
  const processor = new DashboardBriefingJobProcessor({
    async generateBriefing(dashboardId, user, options) {
      received = { dashboardId, user, options };
      return {
        briefing: {
          id: 'briefing-1',
          dashboardId,
          status: 'READY',
          sourceSnapshotHash: 'hash-1',
          generatedAt: '2026-03-26T08:05:00.000Z',
          modelName: 'stub',
          promptVersion: 'v1',
          scriptText: 'Hello',
          scriptJson: {},
          estimatedDurationSeconds: 60,
          errorMessage: null,
          sourceWidgetTypes: ['weather'],
          createdAt: '2026-03-26T08:04:00.000Z',
          updatedAt: '2026-03-26T08:05:00.000Z',
          audio: null
        },
        reused: false
      };
    }
  });

  const result = await processor.process({
    body: JSON.stringify({
      type: 'GenerateDashboardAudioBriefingRequested',
      payload: createMessage()
    }),
    messageId: 'sqs-1'
  });

  assert.equal(result, 'processed');
  assert.deepEqual(received, {
    dashboardId: 'dash-1',
    user: {
      tenantId: 'tenant-1',
      userId: 'user-1',
      displayName: 'Ralfe',
      phoneticName: 'Ralf',
      timezone: 'Europe/Paris',
      locale: 'en-GB',
      email: 'ralfe@example.com',
      isAdmin: false
    },
    options: {
      force: true,
      jobId: 'job-1'
    }
  });
});

function createMessage() {
  return {
    schemaVersion: 1,
    jobId: 'job-1',
    dashboardId: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    ownerDisplayName: 'Ralfe',
    ownerPhoneticName: 'Ralf',
    ownerTimezone: 'Europe/Paris',
    ownerLocale: 'en-GB',
    ownerEmail: 'ralfe@example.com',
    ownerIsAdmin: false,
    force: true,
    correlationId: null,
    causationId: null,
    requestedAt: '2026-03-26T08:00:00.000Z'
  };
}
