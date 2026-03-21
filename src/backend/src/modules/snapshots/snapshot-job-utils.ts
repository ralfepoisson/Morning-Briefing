import { createHash, randomUUID } from 'node:crypto';
import type { SnapshotTriggerSource } from './snapshot-job-types.js';

export function hashWidgetConfig(config: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(config)).digest('hex');
}

export function buildSnapshotJobIdempotencyKey(input: {
  widgetId: string;
  snapshotDate: string;
  widgetConfigHash: string;
  triggerSource: SnapshotTriggerSource;
  requestedAt?: Date;
  bypassDuplicateCheck?: boolean;
}): string {
  const scope = buildSnapshotJobScope(
    input.triggerSource,
    input.requestedAt || new Date(),
    input.bypassDuplicateCheck === true
  );

  return `${input.widgetId}:${input.snapshotDate}:${input.widgetConfigHash}:${scope}`;
}

export function createSnapshotJobId(): string {
  return randomUUID();
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function buildSnapshotJobScope(triggerSource: SnapshotTriggerSource, requestedAt: Date, bypassDuplicateCheck: boolean): string {
  if (triggerSource === 'manual_refresh' && bypassDuplicateCheck) {
    return `manual-bypass:${requestedAt.toISOString()}`;
  }

  if (triggerSource === 'manual_refresh') {
    return `manual:${formatFifteenMinuteBucket(requestedAt)}`;
  }

  return triggerSource;
}

function formatFifteenMinuteBucket(date: Date): string {
  const minutes = Math.floor(date.getUTCMinutes() / 15) * 15;

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join('') + 'T' + [
    pad(date.getUTCHours()),
    pad(minutes)
  ].join('');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>(function build(next, key) {
      next[key] = sortValue((value as Record<string, unknown>)[key]);
      return next;
    }, {});
}
