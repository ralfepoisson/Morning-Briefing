import { createHash, randomUUID } from 'node:crypto';
export function hashWidgetConfig(config) {
    return createHash('sha256').update(stableStringify(config)).digest('hex');
}
export function buildSnapshotJobIdempotencyKey(input) {
    return `${input.widgetId}:${input.snapshotDate}:${input.widgetConfigHash}`;
}
export function createSnapshotJobId() {
    return randomUUID();
}
export function stableStringify(value) {
    return JSON.stringify(sortValue(value));
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
