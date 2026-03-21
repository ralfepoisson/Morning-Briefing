import { SQSClient } from '@aws-sdk/client-sqs';
import { getSnapshotQueueConfig } from './snapshot-queue-config.js';
export function createSnapshotSqsClient(env = process.env) {
    const config = getSnapshotQueueConfig(env);
    return new SQSClient({
        region: config.awsRegion,
        endpoint: config.awsEndpointUrl || undefined,
        credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY
            }
            : undefined
    });
}
