import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  appendApplicationLogToFile,
  listPersistedApplicationLogs,
  summarizePersistedApplicationLogs
} from './application-log-file.js';

test('application log file stores and reloads log entries', async function () {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'morning-briefing-logs-'));
  const filePath = path.join(tempDir, 'application.log.ndjson');

  await appendApplicationLogToFile({
    id: 'log-1',
    timestamp: '2026-03-20T20:00:00.000Z',
    level: 'info',
    scope: 'backend',
    event: 'backend_started',
    message: 'Backend listening on http://127.0.0.1:3000',
    context: {
      host: '127.0.0.1'
    }
  }, filePath);
  await appendApplicationLogToFile({
    id: 'log-2',
    timestamp: '2026-03-20T20:05:00.000Z',
    level: 'error',
    scope: 'snapshot-service',
    event: 'widget_snapshot_failed',
    message: 'Google Calendar request failed with status 403.',
    context: {
      widgetId: 'widget-1'
    }
  }, filePath);

  const contents = await readFile(filePath, 'utf8');
  const logs = await listPersistedApplicationLogs({
    levels: ['error', 'info']
  }, filePath);
  const summary = await summarizePersistedApplicationLogs(filePath);

  assert.match(contents, /backend_started/);
  assert.equal(logs.length, 2);
  assert.equal(logs[0].id, 'log-2');
  assert.equal(logs[1].id, 'log-1');
  assert.deepEqual(summary, {
    info: 1,
    warn: 0,
    error: 1
  });
});
