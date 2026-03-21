import { logApplicationEvent } from '../admin/application-logger.js';
export function logSnapshotJob(level, event, context) {
    logApplicationEvent({
        level,
        scope: 'snapshot-jobs',
        event,
        message: buildSnapshotMessage(event, context),
        context
    });
}
function buildSnapshotMessage(event, context) {
    if (typeof context.error === 'string' && context.error) {
        return event + ': ' + context.error;
    }
    if (typeof context.widgetId === 'string' && typeof context.snapshotDate === 'string') {
        return event + ' for ' + context.widgetId + ' on ' + context.snapshotDate;
    }
    return event;
}
