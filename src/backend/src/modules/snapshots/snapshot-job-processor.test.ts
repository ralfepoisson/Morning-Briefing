import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotJobProcessor } from './snapshot-job-processor.js';
import type { ClaimSnapshotJobResult } from './snapshot-repository.js';

test('SnapshotJobProcessor skips stale messages and records the skip', async function () {
  const repository = new InMemoryJobRepository({
    status: 'claimed',
    jobId: 'job-1',
    attemptCount: 1
  });
  const snapshotService = new InMemorySnapshotService({
    status: 'skipped',
    reason: 'stale_message'
  });
  const processor = new SnapshotJobProcessor(repository, snapshotService);

  const result = await processor.process({
    body: JSON.stringify({
      type: 'GenerateWidgetSnapshotRequested',
      payload: createMessage()
    }),
    messageId: 'sqs-1'
  });

  assert.equal(result, 'skipped');
  assert.equal(repository.skipped.length, 1);
  assert.deepEqual(repository.skipped[0], {
    idempotencyKey: 'widget-1:2026-03-19:hash-1',
    reason: 'stale_message'
  });
});

test('SnapshotJobProcessor marks successful work as completed', async function () {
  const repository = new InMemoryJobRepository({
    status: 'claimed',
    jobId: 'job-1',
    attemptCount: 1
  });
  const snapshotService = new InMemorySnapshotService({
    status: 'generated'
  });
  const processor = new SnapshotJobProcessor(repository, snapshotService);

  const result = await processor.process({
    body: JSON.stringify({
      type: 'GenerateWidgetSnapshotRequested',
      payload: createMessage()
    }),
    messageId: 'sqs-1'
  });

  assert.equal(result, 'processed');
  assert.deepEqual(repository.completed, ['widget-1:2026-03-19:hash-1']);
});

class InMemoryJobRepository {
  public completed: string[] = [];
  public skipped: Array<{ idempotencyKey: string; reason: string }> = [];
  public failed: Array<{ idempotencyKey: string; reason: string }> = [];

  constructor(private readonly claimResult: ClaimSnapshotJobResult) {}

  async claimSnapshotJob() {
    return this.claimResult;
  }

  async completeSnapshotJob(idempotencyKey: string) {
    this.completed.push(idempotencyKey);
  }

  async skipSnapshotJob(idempotencyKey: string, reason: string) {
    this.skipped.push({
      idempotencyKey,
      reason
    });
  }

  async failSnapshotJob(idempotencyKey: string, reason: string) {
    this.failed.push({
      idempotencyKey,
      reason
    });
  }
}

class InMemorySnapshotService {
  constructor(
    private readonly result:
      | { status: 'generated' }
      | { status: 'skipped'; reason: 'stale_message' }
  ) {}

  async generateForWidget() {
    return this.result;
  }
}

function createMessage() {
  return {
    schemaVersion: 1,
    jobId: 'job-1',
    idempotencyKey: 'widget-1:2026-03-19:hash-1',
    widgetId: 'widget-1',
    dashboardId: 'dash-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    widgetConfigVersion: 1,
    widgetConfigHash: 'hash-1',
    snapshotDate: '2026-03-19',
    snapshotPeriod: 'day',
    triggerSource: 'config_updated',
    bypassDuplicateCheck: false,
    correlationId: null,
    causationId: null,
    requestedAt: '2026-03-19T08:00:00.000Z'
  };
}
