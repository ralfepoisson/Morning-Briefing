import test from 'node:test';
import assert from 'node:assert/strict';
import { ChangeMessageVisibilityCommand, DeleteMessageBatchCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { createVisibilityHeartbeat, runSnapshotWorkerOnce } from './snapshot-worker.js';

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

test('runSnapshotWorkerOnce settles successful messages and leaves failed messages for retry', async function () {
  const commands: Array<ReceiveMessageCommand | DeleteMessageBatchCommand> = [];
  const processed: string[] = [];
  const sqs = {
    async send(command: ReceiveMessageCommand | DeleteMessageBatchCommand) {
      commands.push(command);

      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [
            { MessageId: 'ok-1', ReceiptHandle: 'receipt-ok-1', Body: 'ok-1' },
            { MessageId: 'failed-1', ReceiptHandle: 'receipt-failed-1', Body: 'failed-1' },
            { MessageId: 'ok-2', ReceiptHandle: 'receipt-ok-2', Body: 'ok-2' }
          ]
        };
      }

      return {};
    }
  };
  const processor = {
    async process(message: { body: string }) {
      processed.push(message.body);

      if (message.body === 'failed-1') {
        throw new Error('temporary failure');
      }

      return 'processed';
    }
  };

  const settledCount = await runSnapshotWorkerOnce(sqs, processor, {
    SNAPSHOT_QUEUE_URL: 'https://example.com/queue',
    SNAPSHOT_WORKER_MAX_MESSAGES: '3'
  });

  assert.equal(settledCount, 2);
  assert.deepEqual(processed, ['ok-1', 'failed-1', 'ok-2']);
  const deletion = commands.find((command) => command instanceof DeleteMessageBatchCommand) as DeleteMessageBatchCommand;
  assert.deepEqual(deletion.input.Entries, [
    { Id: 'ok-1', ReceiptHandle: 'receipt-ok-1' },
    { Id: 'ok-2', ReceiptHandle: 'receipt-ok-2' }
  ]);
});

test('runSnapshotWorkerOnce leaves an actively-processing duplicate for retry', async function () {
  const commands: Array<ReceiveMessageCommand | DeleteMessageBatchCommand> = [];
  const sqs = {
    async send(command: ReceiveMessageCommand | DeleteMessageBatchCommand) {
      commands.push(command);

      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [{ MessageId: 'msg-1', ReceiptHandle: 'receipt-1', Body: 'retry' }]
        };
      }

      return {};
    }
  };

  const settledCount = await runSnapshotWorkerOnce(sqs, {
    async process() {
      return 'retry';
    }
  }, {
    SNAPSHOT_QUEUE_URL: 'https://example.com/queue'
  });

  assert.equal(settledCount, 0);
  assert.equal(commands.some((command) => command instanceof DeleteMessageBatchCommand), false);
});

test('runSnapshotWorkerOnce reports partial SQS delete failures', async function () {
  const sqs = {
    async send(command: ReceiveMessageCommand | DeleteMessageBatchCommand) {
      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [{ MessageId: 'msg-1', ReceiptHandle: 'receipt-1', Body: 'ok' }]
        };
      }

      return {
        Failed: [{ Id: 'msg-1', Code: 'InternalError', Message: 'try again' }]
      };
    }
  };

  await assert.rejects(runSnapshotWorkerOnce(sqs, {
    async process() {
      return 'processed';
    }
  }, {
    SNAPSHOT_QUEUE_URL: 'https://example.com/queue'
  }), /Failed to delete 1 processed SQS message/);
});

test('createVisibilityHeartbeat renews visibility and can be stopped', async function () {
  let scheduled: (() => void) | null = null;
  let cleared = false;
  const commands: ChangeMessageVisibilityCommand[] = [];
  const heartbeat = createVisibilityHeartbeat({
    async send(command) {
      assert.ok(command instanceof ChangeMessageVisibilityCommand);
      commands.push(command);
      return {};
    }
  }, 'https://example.com/queue', 'receipt-1', 60, 20, {
    setInterval(callback) {
      scheduled = callback;
      return 123;
    },
    clearInterval(handle) {
      assert.equal(handle, 123);
      cleared = true;
    }
  });

  assert.ok(scheduled);
  await (scheduled as unknown as () => Promise<void>)();
  heartbeat.stop();

  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].input, {
    QueueUrl: 'https://example.com/queue',
    ReceiptHandle: 'receipt-1',
    VisibilityTimeout: 60
  });
  assert.equal(cleared, true);
});
