import test from 'node:test';
import assert from 'node:assert/strict';
import { NightlyRefreshService } from './nightly-refresh-service.js';
import type { SnapshotJobPublisher, PublishWidgetSnapshotJobInput } from './snapshot-job-publisher.js';

test('NightlyRefreshService enqueues one snapshot job per eligible widget', async function () {
  const repository = {
    async listWidgetsForScheduledRefresh() {
      return [
        {
          id: 'widget-1',
          tenantId: 'tenant-1',
          dashboardId: 'dash-1',
          ownerUserId: 'user-1',
          type: 'weather',
          title: 'Weather Outlook',
          x: 0,
          y: 0,
          width: 320,
          height: 320,
          minWidth: 320,
          minHeight: 320,
          isVisible: true,
          sortOrder: 1,
          refreshMode: 'SNAPSHOT' as const,
          version: 5,
          config: {},
          configHash: 'hash-1',
          data: {},
          connections: [],
          createdAt: new Date('2026-03-19T07:00:00.000Z'),
          updatedAt: new Date('2026-03-19T07:00:00.000Z')
        }
      ];
    }
  };
  const publisher = new InMemoryPublisher();
  const service = new NightlyRefreshService(repository, publisher);

  const result = await service.enqueueDueWidgets(new Date('2026-03-19T01:00:00.000Z'));

  assert.deepEqual(result, {
    enqueuedCount: 1
  });
  assert.equal(publisher.items.length, 1);
  assert.equal(publisher.items[0].triggerSource, 'scheduled_refresh');
  assert.equal(publisher.items[0].snapshotDate, '2026-03-19');
});

class InMemoryPublisher implements SnapshotJobPublisher {
  public items: PublishWidgetSnapshotJobInput[] = [];

  async publishGenerateWidgetSnapshot(input: PublishWidgetSnapshotJobInput) {
    this.items.push(input);

    return {
      schemaVersion: 1 as const,
      jobId: 'job-1',
      idempotencyKey: 'key-1',
      widgetId: input.widgetId,
      dashboardId: input.dashboardId,
      tenantId: input.tenantId,
      userId: input.userId,
      widgetConfigVersion: input.widgetConfigVersion,
      widgetConfigHash: input.widgetConfigHash,
      snapshotDate: input.snapshotDate,
      snapshotPeriod: 'day' as const,
      triggerSource: input.triggerSource,
      bypassDuplicateCheck: input.bypassDuplicateCheck === true,
      correlationId: null,
      causationId: null,
      requestedAt: new Date().toISOString()
    };
  }
}
