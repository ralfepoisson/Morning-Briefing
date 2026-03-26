import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextDailyUtcRunAt } from './daily-utc-scheduler.js';

test('getNextDailyUtcRunAt returns same-day run when the scheduled time is still ahead', function () {
  const nextRun = getNextDailyUtcRunAt(new Date('2026-03-26T00:15:00.000Z'), 1, 0);

  assert.equal(nextRun.toISOString(), '2026-03-26T01:00:00.000Z');
});

test('getNextDailyUtcRunAt rolls to the following day when the scheduled time has passed', function () {
  const nextRun = getNextDailyUtcRunAt(new Date('2026-03-26T05:15:00.000Z'), 5, 0);

  assert.equal(nextRun.toISOString(), '2026-03-27T05:00:00.000Z');
});
