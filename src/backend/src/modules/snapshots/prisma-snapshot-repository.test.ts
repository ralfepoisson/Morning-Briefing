import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaSnapshotRepository } from './prisma-snapshot-repository.js';

test('claimSnapshotJob reclaims an expired processing lease', async function () {
  const updates: Array<Record<string, unknown>> = [];
  const repository = new PrismaSnapshotRepository({
    snapshotGenerationJob: {
      async findUnique() {
        return {
          id: 'persisted-job-1',
          status: 'PROCESSING',
          attemptCount: 1,
          leaseExpiresAt: new Date('2026-03-26T07:59:00.000Z')
        };
      },
      async updateMany(input: Record<string, unknown>) {
        updates.push(input);
        return { count: 1 };
      },
      async findUniqueOrThrow() {
        return {
          id: 'persisted-job-1',
          attemptCount: 2
        };
      }
    }
  } as never);

  const result = await repository.claimSnapshotJob(
    createMessage(),
    'message-2',
    new Date('2026-03-26T08:10:00.000Z'),
    new Date('2026-03-26T08:00:00.000Z')
  );

  assert.deepEqual(result, {
    status: 'claimed',
    jobId: 'persisted-job-1',
    attemptCount: 2
  });
  assert.equal(updates.length, 1);
  assert.equal((updates[0].data as { status: string }).status, 'PROCESSING');
});

test('claimSnapshotJob does not reclaim an active processing lease', async function () {
  const updates: Array<Record<string, unknown>> = [];
  const repository = new PrismaSnapshotRepository({
    snapshotGenerationJob: {
      async findUnique() {
        return {
          id: 'persisted-job-1',
          status: 'PROCESSING',
          attemptCount: 1,
          leaseExpiresAt: new Date('2026-03-26T08:10:00.000Z')
        };
      },
      async update(input: Record<string, unknown>) {
        updates.push(input);
        return { id: 'persisted-job-1' };
      }
    }
  } as never);

  const result = await repository.claimSnapshotJob(
    createMessage(),
    'message-2',
    new Date('2026-03-26T08:20:00.000Z'),
    new Date('2026-03-26T08:00:00.000Z')
  );

  assert.deepEqual(result, {
    status: 'already_processing',
    jobId: 'persisted-job-1'
  });
  assert.equal((updates[0].data as { duplicateSkipCount: object }).duplicateSkipCount !== undefined, true);
});

function createMessage() {
  return {
    schemaVersion: 1 as const,
    jobId: 'job-1',
    idempotencyKey: 'widget-1:2026-03-26:hash-1:scheduled_refresh',
    widgetId: 'widget-1',
    dashboardId: 'dash-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    widgetConfigVersion: 1,
    widgetConfigHash: 'hash-1',
    snapshotDate: '2026-03-26',
    snapshotPeriod: 'day' as const,
    triggerSource: 'scheduled_refresh' as const,
    bypassDuplicateCheck: false,
    correlationId: null,
    causationId: null,
    requestedAt: '2026-03-26T08:00:00.000Z'
  };
}
