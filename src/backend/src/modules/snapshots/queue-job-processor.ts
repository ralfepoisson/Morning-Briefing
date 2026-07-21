import type { DashboardBriefingJobProcessor } from '../dashboard-briefings/dashboard-briefing-job-processor.js';
import type { SnapshotJobProcessor, SnapshotQueueMessage } from './snapshot-job-processor.js';

export class QueueJobProcessor {
  constructor(
    private readonly snapshotJobProcessor: SnapshotJobProcessor,
    private readonly dashboardBriefingJobProcessor: DashboardBriefingJobProcessor
  ) {}

  async process(message: SnapshotQueueMessage): Promise<'processed' | 'skipped' | 'retry'> {
    const type = parseQueueMessageType(message.body);

    if (type === 'GenerateWidgetSnapshotRequested') {
      return this.snapshotJobProcessor.process(message);
    }

    if (type === 'GenerateDashboardAudioBriefingRequested') {
      return this.dashboardBriefingJobProcessor.process(message);
    }

    throw new Error('Queue message type is invalid.');
  }
}

function parseQueueMessageType(body: string): string {
  const parsed = JSON.parse(body) as { type?: unknown };

  if (!parsed || typeof parsed.type !== 'string') {
    throw new Error('Queue message type is invalid.');
  }

  return parsed.type;
}
