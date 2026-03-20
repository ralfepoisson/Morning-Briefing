import { createHash, randomUUID } from 'node:crypto';

export function hashWidgetConfig(config: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(config)).digest('hex');
}

export function buildSnapshotJobIdempotencyKey(input: {
  widgetId: string;
  snapshotDate: string;
  widgetConfigHash: string;
}): string {
  return `${input.widgetId}:${input.snapshotDate}:${input.widgetConfigHash}`;
}

export function createSnapshotJobId(): string {
  return randomUUID();
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
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
