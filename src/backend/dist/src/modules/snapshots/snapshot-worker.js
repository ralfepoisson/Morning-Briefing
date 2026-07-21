import { ChangeMessageVisibilityCommand, DeleteMessageBatchCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
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
        const heartbeat = message.ReceiptHandle
            ? createVisibilityHeartbeat(sqs, config.queueUrl, message.ReceiptHandle, config.workerVisibilityTimeoutSeconds, config.workerVisibilityHeartbeatSeconds)
            : null;
        try {
            const result = await processor.process({
                body: message.Body || '',
                messageId: message.MessageId,
                receiptHandle: message.ReceiptHandle
            });
            if (result === 'retry') {
                logSnapshotJob('info', 'snapshot_worker_message_retry_deferred', {
                    messageId: message.MessageId || null
                });
                continue;
            }
        }
        catch (error) {
            if (!isInvalidQueueMessageError(error)) {
                logSnapshotJob('error', 'snapshot_worker_message_failed', {
                    messageId: message.MessageId || null,
                    error: error instanceof Error ? error.message : 'Queue message processing failed.'
                });
                continue;
            }
            logSnapshotJob('warn', 'snapshot_worker_message_discarded', {
                messageId: message.MessageId || null,
                receiptHandle: message.ReceiptHandle || null,
                error: error instanceof Error ? error.message : 'Queue message is invalid.'
            });
        }
        finally {
            heartbeat?.stop();
        }
        if (message.ReceiptHandle && message.MessageId) {
            deletions.push({
                Id: message.MessageId,
                ReceiptHandle: message.ReceiptHandle
            });
        }
    }
    if (deletions.length) {
        const deleteResult = await sqs.send(new DeleteMessageBatchCommand({
            QueueUrl: config.queueUrl,
            Entries: deletions
        }));
        const failed = 'Failed' in deleteResult && Array.isArray(deleteResult.Failed)
            ? deleteResult.Failed
            : [];
        if (failed.length) {
            logSnapshotJob('error', 'snapshot_worker_message_delete_failed', {
                failedCount: failed.length,
                failures: failed.map(function mapFailure(failure) {
                    return {
                        id: failure.Id || null,
                        code: failure.Code || null,
                        message: failure.Message || null
                    };
                })
            });
            throw new Error(`Failed to delete ${failed.length} processed SQS message(s).`);
        }
    }
    logSnapshotJob('info', 'snapshot_worker_batch_completed', {
        processedCount: deletions.length
    });
    return deletions.length;
}
export function createVisibilityHeartbeat(sqs, queueUrl, receiptHandle, visibilityTimeoutSeconds, heartbeatSeconds, scheduler = {
    setInterval(callback, intervalMs) {
        return setInterval(callback, intervalMs);
    },
    clearInterval(handle) {
        clearInterval(handle);
    }
}) {
    const handle = scheduler.setInterval(async function renewVisibility() {
        try {
            await sqs.send(new ChangeMessageVisibilityCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: receiptHandle,
                VisibilityTimeout: visibilityTimeoutSeconds
            }));
        }
        catch (error) {
            logSnapshotJob('error', 'snapshot_worker_visibility_heartbeat_failed', {
                error: error instanceof Error ? error.message : 'Unable to renew SQS message visibility.'
            });
        }
    }, Math.max(1, heartbeatSeconds) * 1000);
    return {
        stop() {
            scheduler.clearInterval(handle);
        }
    };
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
