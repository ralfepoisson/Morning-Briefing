import test from 'node:test';
import assert from 'node:assert/strict';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { SqsSnapshotJobPublisher } from './sqs-snapshot-job-publisher.js';

test('SqsSnapshotJobPublisher sends the expected widget snapshot command', async function () {
  const commands: SendMessageCommand[] = [];
  const publisher = new SqsSnapshotJobPublisher({
    async send(command) {
      commands.push(command as SendMessageCommand);
      return {};
    }
  }, 'https://example.com/queue');

  const payload = await publisher.publishGenerateWidgetSnapshot({
    widgetId: 'widget-1',
    dashboardId: 'dash-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    widgetConfigVersion: 4,
    widgetConfigHash: 'abc123',
    snapshotDate: '2026-03-19',
    triggerSource: 'config_updated',
    correlationId: 'req-1',
    causationId: 'req-1',
    requestedAt: new Date('2026-03-19T08:00:00.000Z')
  });

  assert.equal(commands.length, 1);
  const input = commands[0].input;
  assert.equal(input.QueueUrl, 'https://example.com/queue');

  const body = JSON.parse(String(input.MessageBody));
  assert.equal(body.type, 'GenerateWidgetSnapshotRequested');
  assert.equal(body.payload.widgetId, 'widget-1');
  assert.equal(body.payload.widgetConfigHash, 'abc123');
  assert.equal(body.payload.snapshotDate, '2026-03-19');
  assert.equal(body.payload.idempotencyKey, payload.idempotencyKey);
});
