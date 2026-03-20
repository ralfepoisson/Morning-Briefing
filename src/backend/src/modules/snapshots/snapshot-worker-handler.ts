import { createSnapshotJobProcessor } from './snapshot-runtime.js';

type LambdaSqsRecord = {
  body: string;
  messageId: string;
  receiptHandle: string;
};

export async function handleSnapshotQueueBatch(event: { Records: LambdaSqsRecord[] }) {
  const processor = createSnapshotJobProcessor();

  for (const record of event.Records || []) {
    await processor.process({
      body: record.body,
      messageId: record.messageId,
      receiptHandle: record.receiptHandle
    });
  }
}
