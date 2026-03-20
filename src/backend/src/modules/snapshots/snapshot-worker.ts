import { DeleteMessageBatchCommand, ReceiveMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import { logSnapshotJob } from './snapshot-job-logger.js';
import { getSnapshotQueueConfig } from './snapshot-queue-config.js';
import type { SnapshotJobProcessor } from './snapshot-job-processor.js';

export async function runSnapshotWorkerOnce(
  sqs: Pick<SQSClient, 'send'>,
  processor: SnapshotJobProcessor,
  env: NodeJS.ProcessEnv = process.env
): Promise<number> {
  const config = getSnapshotQueueConfig(env);

  if (!config.queueUrl) {
    throw new Error('SNAPSHOT_QUEUE_URL is required to run the snapshot worker.');
  }

  const response = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: config.queueUrl,
    MaxNumberOfMessages: Math.min(config.workerMaxMessages, 10),
    WaitTimeSeconds: Math.min(config.workerWaitTimeSeconds, 20),
    VisibilityTimeout: config.workerVisibilityTimeoutSeconds
  }));
  const messages = response.Messages || [];

  if (!messages.length) {
    return 0;
  }

  const deletions: Array<{ Id: string; ReceiptHandle: string }> = [];

  for (const message of messages) {
    await processor.process({
      body: message.Body || '',
      messageId: message.MessageId,
      receiptHandle: message.ReceiptHandle
    });

    if (message.ReceiptHandle && message.MessageId) {
      deletions.push({
        Id: message.MessageId,
        ReceiptHandle: message.ReceiptHandle
      });
    }
  }

  if (deletions.length) {
    await sqs.send(new DeleteMessageBatchCommand({
      QueueUrl: config.queueUrl,
      Entries: deletions
    }));
  }

  logSnapshotJob('info', 'snapshot_worker_batch_completed', {
    processedCount: deletions.length
  });

  return deletions.length;
}

export async function runSnapshotWorkerLoop(
  sqs: Pick<SQSClient, 'send'>,
  processor: SnapshotJobProcessor,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const config = getSnapshotQueueConfig(env);

  while (true) {
    try {
      await runSnapshotWorkerOnce(sqs, processor, env);
    } catch (error) {
      logSnapshotJob('error', 'snapshot_worker_loop_error', {
        error: error instanceof Error ? error.message : 'Unknown worker error.'
      });
    }

    await wait(config.workerPollIntervalMs);
  }
}

async function wait(durationMs: number): Promise<void> {
  await new Promise(function resolveWait(resolve) {
    setTimeout(resolve, durationMs);
  });
}
