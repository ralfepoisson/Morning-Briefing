import { createHash, randomUUID } from 'node:crypto';
export function hashWidgetConfig(config) {
    return createHash('sha256').update(stableStringify(config)).digest('hex');
}
export function buildSnapshotJobIdempotencyKey(input) {
    const scope = buildSnapshotJobScope(input.triggerSource, input.requestedAt || new Date(), input.bypassDuplicateCheck === true);
    return `${input.widgetId}:${input.snapshotDate}:${input.widgetConfigHash}:${scope}`;
}
export function createSnapshotJobId() {
    return randomUUID();
}
export function stableStringify(value) {
    return JSON.stringify(sortValue(value));
}
function buildSnapshotJobScope(triggerSource, requestedAt, bypassDuplicateCheck) {
    if (triggerSource === 'manual_refresh' && bypassDuplicateCheck) {
        return `manual-bypass:${requestedAt.toISOString()}`;
    }
    if (triggerSource === 'manual_refresh') {
        return `manual:${formatFifteenMinuteBucket(requestedAt)}`;
    }
    return triggerSource;
}
function formatFifteenMinuteBucket(date) {
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
function pad(value) {
    return String(value).padStart(2, '0');
}
function sortValue(value) {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    return Object.keys(value)
        .sort()
        .reduce(function build(next, key) {
        next[key] = sortValue(value[key]);
        return next;
    }, {});
}
