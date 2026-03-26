import test from 'node:test';
import assert from 'node:assert/strict';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { SqsDashboardBriefingJobPublisher } from './sqs-dashboard-briefing-job-publisher.js';

test('SqsDashboardBriefingJobPublisher sends the expected dashboard audio command', async function () {
  const commands: SendMessageCommand[] = [];
  const publisher = new SqsDashboardBriefingJobPublisher({
    async send(command) {
      commands.push(command as SendMessageCommand);
      return {};
    }
  }, 'https://example.com/queue');

  const payload = await publisher.publishGenerateDashboardAudioBriefing({
    dashboardId: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    ownerDisplayName: 'Ralfe',
    ownerTimezone: 'Europe/Paris',
    ownerLocale: 'en-GB',
    ownerEmail: 'ralfe@example.com',
    ownerIsAdmin: false,
    force: true,
    correlationId: 'req-1',
    causationId: 'req-1',
    requestedAt: new Date('2026-03-26T08:00:00.000Z')
  });

  assert.equal(commands.length, 1);
  const input = commands[0].input;
  assert.equal(input.QueueUrl, 'https://example.com/queue');

  const body = JSON.parse(String(input.MessageBody));
  assert.equal(body.type, 'GenerateDashboardAudioBriefingRequested');
  assert.equal(body.payload.dashboardId, 'dash-1');
  assert.equal(body.payload.ownerUserId, 'user-1');
  assert.equal(body.payload.force, true);
  assert.equal(body.payload.jobId, payload.jobId);
});
