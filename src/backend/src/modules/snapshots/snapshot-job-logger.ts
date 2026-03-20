import { logApplicationEvent } from '../admin/application-logger.js';

type SnapshotLogLevel = 'info' | 'warn' | 'error';

export function logSnapshotJob(level: SnapshotLogLevel, event: string, context: Record<string, unknown>): void {
  logApplicationEvent({
    level,
    scope: 'snapshot-jobs',
    event,
    message: buildSnapshotMessage(event, context),
    context
  });
}

function buildSnapshotMessage(event: string, context: Record<string, unknown>): string {
  if (typeof context.error === 'string' && context.error) {
    return event + ': ' + context.error;
  }

  if (typeof context.widgetId === 'string' && typeof context.snapshotDate === 'string') {
    return event + ' for ' + context.widgetId + ' on ' + context.snapshotDate;
  }

  return event;
}
