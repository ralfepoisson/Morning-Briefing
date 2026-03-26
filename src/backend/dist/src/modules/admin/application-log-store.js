const MAX_LOG_ENTRIES = 500;
const logEntries = [];
export function appendApplicationLog(entry) {
    const storedEntry = {
        id: createLogId(),
        ...entry
    };
    logEntries.push(storedEntry);
    if (logEntries.length > MAX_LOG_ENTRIES) {
        logEntries.splice(0, logEntries.length - MAX_LOG_ENTRIES);
    }
    return storedEntry;
}
export function listApplicationLogs(filters = {}) {
    return filterApplicationLogs(logEntries, filters);
}
export function filterApplicationLogs(entries, filters = {}) {
    const normalizedSearch = normalizeSearch(filters.search);
    const includedLevels = new Set(filters.levels && filters.levels.length ? filters.levels : ['info', 'warn', 'error']);
    const limit = Math.max(1, Math.min(filters.limit || 200, MAX_LOG_ENTRIES));
    const sinceTimestamp = filters.since ? Date.parse(filters.since) : Number.NaN;
    return entries
        .filter(function filterEntry(entry) {
        if (!includedLevels.has(entry.level)) {
            return false;
        }
        if (Number.isFinite(sinceTimestamp) && Date.parse(entry.timestamp) < sinceTimestamp) {
            return false;
        }
        if (!normalizedSearch) {
            return true;
        }
        return buildSearchableText(entry).includes(normalizedSearch);
    })
        .slice(0, limit);
}
export function summarizeApplicationLogs() {
    return summarizeEntries(logEntries);
}
export function summarizeEntries(entries) {
    return entries.reduce(function reduceSummary(summary, entry) {
        summary[entry.level] += 1;
        return summary;
    }, {
        info: 0,
        warn: 0,
        error: 0
    });
}
export function resetApplicationLogs() {
    logEntries.splice(0, logEntries.length);
}
function buildSearchableText(entry) {
    return [
        entry.timestamp,
        entry.level,
        entry.scope,
        entry.event,
        entry.message,
        JSON.stringify(entry.context)
    ].join(' ').toLowerCase();
}
function normalizeSearch(value) {
    return (value || '').trim().toLowerCase();
}
function createLogId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
