import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalDevSnapshotWorkerEnabled } from './local-dev-worker.js';

test('isLocalDevSnapshotWorkerEnabled returns true only when explicitly enabled outside production', function () {
  assert.equal(isLocalDevSnapshotWorkerEnabled({
    LOCAL_SNAPSHOT_WORKER_ENABLED: 'true',
    NODE_ENV: 'development'
  }), true);

  assert.equal(isLocalDevSnapshotWorkerEnabled({
    LOCAL_SNAPSHOT_WORKER_ENABLED: 'false',
    NODE_ENV: 'development'
  }), false);

  assert.equal(isLocalDevSnapshotWorkerEnabled({
    LOCAL_SNAPSHOT_WORKER_ENABLED: 'true',
    NODE_ENV: 'production'
  }), false);
});
