import { createSnapshotJobProcessor } from './snapshot-runtime.js';
export async function handleSnapshotQueueBatch(event) {
    const processor = createSnapshotJobProcessor();
    for (const record of event.Records || []) {
        await processor.process({
            body: record.body,
            messageId: record.messageId,
            receiptHandle: record.receiptHandle
        });
    }
}
