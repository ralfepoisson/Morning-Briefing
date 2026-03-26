import test from 'node:test';
import assert from 'node:assert/strict';
import { DeleteMessageBatchCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { runSnapshotWorkerOnce } from './snapshot-worker.js';

test('runSnapshotWorkerOnce discards invalid queue messages so the worker can continue', async function () {
  const commands: Array<ReceiveMessageCommand | DeleteMessageBatchCommand> = [];
  const sqs = {
    async send(command: ReceiveMessageCommand | DeleteMessageBatchCommand) {
      commands.push(command);

      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [
            {
              MessageId: 'msg-1',
              ReceiptHandle: 'receipt-1',
              Body: '{"type":"UnknownMessage"}'
            }
          ]
        };
      }

      return {};
    }
  };
  const processor = {
    async process() {
      throw new Error('Queue message type is invalid.');
    }
  };

  const processedCount = await runSnapshotWorkerOnce(sqs, processor, {
    SNAPSHOT_QUEUE_URL: 'https://example.com/queue',
    SNAPSHOT_QUEUE_WORKER_MAX_MESSAGES: '1',
    SNAPSHOT_QUEUE_WAIT_TIME_SECONDS: '0',
    SNAPSHOT_QUEUE_VISIBILITY_TIMEOUT_SECONDS: '30',
    SNAPSHOT_QUEUE_WORKER_POLL_INTERVAL_MS: '1000'
  });

  assert.equal(processedCount, 1);
  assert.equal(commands.length, 2);
  assert.equal(commands[0] instanceof ReceiveMessageCommand, true);
  assert.equal(commands[1] instanceof DeleteMessageBatchCommand, true);
  assert.deepEqual((commands[1] as DeleteMessageBatchCommand).input.Entries, [
    {
      Id: 'msg-1',
      ReceiptHandle: 'receipt-1'
    }
  ]);
});
