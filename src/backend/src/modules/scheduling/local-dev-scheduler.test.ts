import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalDevSchedulerEnabled } from './local-dev-scheduler.js';

test('isLocalDevSchedulerEnabled returns true only when explicitly enabled outside production', function () {
  assert.equal(isLocalDevSchedulerEnabled({
    LOCAL_SCHEDULER_ENABLED: 'true',
    NODE_ENV: 'development'
  }), true);

  assert.equal(isLocalDevSchedulerEnabled({
    LOCAL_SCHEDULER_ENABLED: 'false',
    NODE_ENV: 'development'
  }), false);

  assert.equal(isLocalDevSchedulerEnabled({
    LOCAL_SCHEDULER_ENABLED: 'true',
    NODE_ENV: 'production'
  }), false);
});
