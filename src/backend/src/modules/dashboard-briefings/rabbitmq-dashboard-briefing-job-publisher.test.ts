import test from 'node:test';
import assert from 'node:assert/strict';
import { RabbitMqDashboardBriefingJobPublisher } from './rabbitmq-dashboard-briefing-job-publisher.js';

test('RabbitMqDashboardBriefingJobPublisher publishes the versioned audio envelope with its job id', async function () {
  const sent: Array<{ envelope: any; messageId: string }> = [];
  const publisher = new RabbitMqDashboardBriefingJobPublisher({
    async publish(envelope, messageId) { sent.push({ envelope, messageId }); }
  });
  const payload = await publisher.publishGenerateDashboardAudioBriefing({
    dashboardId: 'dash-1', tenantId: 'tenant-1', ownerUserId: 'user-1', ownerDisplayName: 'Ralfe',
    ownerPhoneticName: null, ownerTimezone: 'Europe/Paris', ownerLocale: 'en-GB',
    ownerEmail: 'ralfe@example.com', ownerIsAdmin: false, force: true,
    idempotencyKey: 'dash-1:scheduled:2026-03-26', requestedAt: new Date('2026-03-26T08:00:00.000Z')
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].messageId, payload.jobId);
  assert.equal(sent[0].envelope.type, 'GenerateDashboardAudioBriefingRequested');
  assert.equal(sent[0].envelope.payload.idempotencyKey, 'dash-1:scheduled:2026-03-26');
});
