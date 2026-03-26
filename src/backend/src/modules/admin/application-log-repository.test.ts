import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listPersistedApplicationLogs,
  summarizePersistedApplicationLogs
} from './application-log-repository.js';

test('application log repository maps persisted rows into API log entries', async function () {
  const logs = await listPersistedApplicationLogs({
    levels: ['error', 'info']
  }, {
    applicationLogEvent: {
      async findMany() {
        return [
          {
            id: 'log-1',
            timestamp: new Date('2026-03-20T20:00:00.000Z'),
            level: 'INFO',
            scope: 'backend',
            event: 'backend_started',
            message: 'Backend listening on http://127.0.0.1:3000',
            contextJson: {
              host: '127.0.0.1'
            }
          },
          {
            id: 'log-2',
            timestamp: new Date('2026-03-20T20:05:00.000Z'),
            level: 'ERROR',
            scope: 'snapshot-service',
            event: 'widget_snapshot_failed',
            message: 'Google Calendar request failed with status 403.',
            contextJson: {
              widgetId: 'widget-1'
            }
          }
        ];
      },
      async groupBy() {
        return [
          {
            level: 'INFO',
            _count: {
              _all: 1
            }
          },
          {
            level: 'ERROR',
            _count: {
              _all: 1
            }
          }
        ];
      }
    }
  });

  assert.equal(logs.length, 2);
  assert.equal(logs[0].id, 'log-1');
  assert.equal(logs[1].id, 'log-2');
});

test('application log repository summarizes persisted log levels', async function () {
  const summary = await summarizePersistedApplicationLogs({
    applicationLogEvent: {
      async groupBy() {
        return [
          {
            level: 'INFO',
            _count: {
              _all: 3
            }
          },
          {
            level: 'WARN',
            _count: {
              _all: 2
            }
          }
        ];
      }
    }
  } as never);

  assert.deepEqual(summary, {
    info: 3,
    warn: 2,
    error: 0
  });
});
