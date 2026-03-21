import 'dotenv/config';
import { CreateQueueCommand, GetQueueAttributesCommand, GetQueueUrlCommand, SetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { getSnapshotQueueConfig } from '../src/modules/snapshots/snapshot-queue-config.js';
import { createSnapshotSqsClient } from '../src/modules/snapshots/snapshot-sqs-client.js';
const config = getSnapshotQueueConfig();
const sqs = createSnapshotSqsClient();
const dlqUrl = await ensureQueue(config.dlqName);
const dlqAttributes = await sqs.send(new GetQueueAttributesCommand({
    QueueUrl: dlqUrl,
    AttributeNames: ['QueueArn']
}));
const dlqArn = dlqAttributes.Attributes?.QueueArn;
if (!dlqArn) {
    throw new Error('Failed to resolve DLQ ARN.');
}
const queueUrl = await ensureQueue(config.queueName);
await sqs.send(new SetQueueAttributesCommand({
    QueueUrl: queueUrl,
    Attributes: {
        RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: dlqArn,
            maxReceiveCount: config.queueMaxReceiveCount
        })
    }
}));
console.log(JSON.stringify({
    event: 'snapshot_queue_setup_completed',
    queueUrl,
    dlqUrl
}));
async function ensureQueue(queueName) {
    try {
        const existing = await sqs.send(new GetQueueUrlCommand({
            QueueName: queueName
        }));
        if (existing.QueueUrl) {
            return existing.QueueUrl;
        }
    }
    catch {
        // Intentionally ignored so the queue can be created below.
    }
    const created = await sqs.send(new CreateQueueCommand({
        QueueName: queueName
    }));
    if (!created.QueueUrl) {
        throw new Error(`Failed to create queue ${queueName}.`);
    }
    return created.QueueUrl;
}
