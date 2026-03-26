import { DeleteMessageBatchCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { logSnapshotJob } from './snapshot-job-logger.js';
import { getSnapshotQueueConfig } from './snapshot-queue-config.js';
export async function runSnapshotWorkerOnce(sqs, processor, env = process.env) {
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
    const deletions = [];
    for (const message of messages) {
        try {
            await processor.process({
                body: message.Body || '',
                messageId: message.MessageId,
                receiptHandle: message.ReceiptHandle
            });
        }
        catch (error) {
            if (!isInvalidQueueMessageError(error)) {
                throw error;
            }
            logSnapshotJob('warn', 'snapshot_worker_message_discarded', {
                messageId: message.MessageId || null,
                receiptHandle: message.ReceiptHandle || null,
                error: error instanceof Error ? error.message : 'Queue message is invalid.'
            });
        }
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
export async function runSnapshotWorkerLoop(sqs, processor, env = process.env) {
    const config = getSnapshotQueueConfig(env);
    while (true) {
        try {
            await runSnapshotWorkerOnce(sqs, processor, env);
        }
        catch (error) {
            logSnapshotJob('error', 'snapshot_worker_loop_error', {
                error: error instanceof Error ? error.message : 'Unknown worker error.'
            });
        }
        await wait(config.workerPollIntervalMs);
    }
}
async function wait(durationMs) {
    await new Promise(function resolveWait(resolve) {
        setTimeout(resolve, durationMs);
    });
}
function isInvalidQueueMessageError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return (error.message === 'Queue message type is invalid.' ||
        error.message === 'Snapshot queue message is invalid.' ||
        error.message === 'Snapshot queue message payload is invalid.' ||
        error.message === 'Dashboard briefing queue message is invalid.' ||
        error.message === 'Dashboard briefing queue message payload is invalid.');
}
