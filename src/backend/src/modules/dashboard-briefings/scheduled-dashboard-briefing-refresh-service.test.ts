import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduledDashboardBriefingRefreshService } from './scheduled-dashboard-briefing-refresh-service.js';
import type { DashboardBriefingJobPublisher, PublishDashboardAudioBriefingJobInput } from './dashboard-briefing-job-publisher.js';

test('ScheduledDashboardBriefingRefreshService enqueues one job per eligible dashboard', async function () {
  const repository = {
    async listDashboardsForScheduledGeneration() {
      return [
        {
          id: 'dash-1',
          tenantId: 'tenant-1',
          isGenerating: false,
          hasReadySnapshot: true,
          owner: {
            id: 'owner-1',
            displayName: 'Owner One',
            phoneticName: 'Oh-ner',
            timezone: 'Europe/Paris',
            locale: 'en-GB',
            email: 'owner-1@example.com',
            isAdmin: false
          },
          briefingPreference: null
        },
        {
          id: 'dash-2',
          tenantId: 'tenant-1',
          isGenerating: false,
          hasReadySnapshot: true,
          owner: {
            id: 'owner-2',
            displayName: 'Owner Two',
            phoneticName: null,
            timezone: 'Europe/London',
            locale: 'en-GB',
            email: 'owner-2@example.com',
            isAdmin: false
          },
          briefingPreference: {
            enabled: false
          }
        },
        {
          id: 'dash-3',
          tenantId: 'tenant-1',
          isGenerating: true,
          hasReadySnapshot: true,
          owner: {
            id: 'owner-3',
            displayName: 'Owner Three',
            phoneticName: null,
            timezone: 'UTC',
            locale: 'en-US',
            email: 'owner-3@example.com',
            isAdmin: true
          },
          briefingPreference: {
            enabled: true
          }
        }
      ];
    }
  };
  const publisher = new InMemoryPublisher();
  const service = new ScheduledDashboardBriefingRefreshService(repository, publisher);

  const result = await service.enqueueAllDashboards(new Date('2026-03-26T05:00:00.000Z'));

  assert.deepEqual(result, {
    enqueuedCount: 1,
    skippedDisabledCount: 1,
    skippedGeneratingCount: 1,
    skippedMissingSnapshotsCount: 0
  });
  assert.equal(publisher.items.length, 1);
  assert.deepEqual(publisher.items[0], {
    dashboardId: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'owner-1',
    ownerDisplayName: 'Owner One',
    ownerPhoneticName: 'Oh-ner',
    ownerTimezone: 'Europe/Paris',
    ownerLocale: 'en-GB',
    ownerEmail: 'owner-1@example.com',
    ownerIsAdmin: false,
    force: true,
    requestedAt: new Date('2026-03-26T05:00:00.000Z'),
    correlationId: null,
    causationId: null
  });
});

test('ScheduledDashboardBriefingRefreshService skips dashboards without a ready snapshot', async function () {
  const repository = {
    async listDashboardsForScheduledGeneration() {
      return [
        {
          id: 'dash-1',
          tenantId: 'tenant-1',
          isGenerating: false,
          hasReadySnapshot: false,
          owner: {
            id: 'owner-1',
            displayName: 'Owner One',
            phoneticName: null,
            timezone: 'UTC',
            locale: 'en-GB',
            email: 'owner-1@example.com',
            isAdmin: false
          },
          briefingPreference: {
            enabled: true
          }
        }
      ];
    }
  };
  const publisher = new InMemoryPublisher();
  const service = new ScheduledDashboardBriefingRefreshService(repository, publisher);

  const result = await service.enqueueAllDashboards(new Date('2026-03-29T05:00:00.000Z'));

  assert.deepEqual(result, {
    enqueuedCount: 0,
    skippedDisabledCount: 0,
    skippedGeneratingCount: 0,
    skippedMissingSnapshotsCount: 1
  });
  assert.equal(publisher.items.length, 0);
});

class InMemoryPublisher implements DashboardBriefingJobPublisher {
  public items: PublishDashboardAudioBriefingJobInput[] = [];

  async publishGenerateDashboardAudioBriefing(input: PublishDashboardAudioBriefingJobInput) {
    this.items.push(input);

    return {
      schemaVersion: 1 as const,
      jobId: 'job-1',
      dashboardId: input.dashboardId,
      tenantId: input.tenantId,
      ownerUserId: input.ownerUserId,
      ownerDisplayName: input.ownerDisplayName,
      ownerPhoneticName: input.ownerPhoneticName,
      ownerTimezone: input.ownerTimezone,
      ownerLocale: input.ownerLocale,
      ownerEmail: input.ownerEmail,
      ownerIsAdmin: input.ownerIsAdmin,
      force: input.force,
      correlationId: input.correlationId || null,
      causationId: input.causationId || null,
      requestedAt: (input.requestedAt || new Date()).toISOString()
    };
  }
}
