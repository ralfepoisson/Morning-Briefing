export class QueueJobProcessor {
    snapshotJobProcessor;
    dashboardBriefingJobProcessor;
    constructor(snapshotJobProcessor, dashboardBriefingJobProcessor) {
        this.snapshotJobProcessor = snapshotJobProcessor;
        this.dashboardBriefingJobProcessor = dashboardBriefingJobProcessor;
    }
    async process(message) {
        const type = parseQueueMessageType(message.body);
        if (type === 'GenerateWidgetSnapshotRequested') {
            return this.snapshotJobProcessor.process(message);
        }
        if (type === 'GenerateDashboardAudioBriefingRequested') {
            await this.dashboardBriefingJobProcessor.process(message);
            return 'processed';
        }
        throw new Error('Queue message type is invalid.');
    }
}
function parseQueueMessageType(body) {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed.type !== 'string') {
        throw new Error('Queue message type is invalid.');
    }
    return parsed.type;
}
