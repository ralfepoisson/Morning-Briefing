import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardBriefingJobProcessor, parseGenerateDashboardAudioBriefingMessage } from './dashboard-briefing-job-processor.js';

test('DashboardBriefingJobProcessor regenerates audio as the dashboard owner', async function () {
  let received = null;
  const jobs = new InMemoryDashboardBriefingJobRepository();
  const processor = new DashboardBriefingJobProcessor(jobs, {
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
  assert.deepEqual(jobs.completed, ['audio-job-1']);
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

test('DashboardBriefingJobProcessor skips an already completed command without generating or delivering again', async function () {
  let generationCount = 0;
  const jobs = new InMemoryDashboardBriefingJobRepository('already_processed');
  const processor = new DashboardBriefingJobProcessor(jobs, {
    async generateBriefing() {
      generationCount += 1;
      return null;
    }
  });

  const result = await processor.process({
    body: JSON.stringify({
      type: 'GenerateDashboardAudioBriefingRequested',
      payload: createMessage()
    }),
    messageId: 'duplicate-message'
  });

  assert.equal(result, 'skipped');
  assert.equal(generationCount, 0);
});

test('DashboardBriefingJobProcessor leaves an active duplicate for retry', async function () {
  const jobs = new InMemoryDashboardBriefingJobRepository('already_processing');
  const processor = new DashboardBriefingJobProcessor(jobs, {
    async generateBriefing() {
      throw new Error('must not run');
    }
  });

  const result = await processor.process({
    body: JSON.stringify({
      type: 'GenerateDashboardAudioBriefingRequested',
      payload: createMessage()
    }),
    messageId: 'duplicate-message'
  });

  assert.equal(result, 'retry');
});

test('parseGenerateDashboardAudioBriefingMessage uses the job id for legacy command idempotency', function () {
  const message = createMessage();
  delete (message as { idempotencyKey?: string }).idempotencyKey;

  const parsed = parseGenerateDashboardAudioBriefingMessage(JSON.stringify({
    type: 'GenerateDashboardAudioBriefingRequested',
    payload: message
  }));

  assert.equal(parsed.idempotencyKey, 'job-1');
});

function createMessage() {
  return {
    schemaVersion: 1,
    jobId: 'job-1',
    idempotencyKey: 'audio-job-1',
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

class InMemoryDashboardBriefingJobRepository {
  public completed: string[] = [];
  public failed: string[] = [];

  constructor(private readonly claimStatus: 'claimed' | 'already_processed' | 'already_processing' = 'claimed') {}

  async claimDashboardBriefingJob() {
    if (this.claimStatus === 'claimed') {
      return { status: 'claimed' as const, jobId: 'persisted-audio-job-1', attemptCount: 1 };
    }

    return { status: this.claimStatus, jobId: 'persisted-audio-job-1' };
  }

  async completeDashboardBriefingJob(idempotencyKey: string) {
    this.completed.push(idempotencyKey);
  }

  async failDashboardBriefingJob(idempotencyKey: string) {
    this.failed.push(idempotencyKey);
  }
}
