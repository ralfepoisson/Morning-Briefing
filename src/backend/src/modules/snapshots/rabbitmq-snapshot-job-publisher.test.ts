import test from 'node:test';
import assert from 'node:assert/strict';
import { RabbitMqSnapshotJobPublisher } from './rabbitmq-snapshot-job-publisher.js';

test('RabbitMqSnapshotJobPublisher publishes the versioned widget envelope with its job id', async function () {
  const sent: Array<{ envelope: any; messageId: string }> = [];
  const publisher = new RabbitMqSnapshotJobPublisher({
    async publish(envelope, messageId) { sent.push({ envelope, messageId }); }
  });
  const payload = await publisher.publishGenerateWidgetSnapshot({
    widgetId: 'widget-1', dashboardId: 'dash-1', tenantId: 'tenant-1', userId: 'user-1',
    widgetConfigVersion: 4, widgetConfigHash: 'abc123', snapshotDate: '2026-03-19',
    triggerSource: 'config_updated', requestedAt: new Date('2026-03-19T08:00:00.000Z')
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].messageId, payload.jobId);
  assert.equal(sent[0].envelope.type, 'GenerateWidgetSnapshotRequested');
  assert.equal(sent[0].envelope.payload.idempotencyKey, payload.idempotencyKey);
});
