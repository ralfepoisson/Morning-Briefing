import { listPersistedApplicationLogs, summarizePersistedApplicationLogs } from './application-log-repository.js';
export async function registerLogRoutes(app, dependencies = {
    listLogs: listPersistedApplicationLogs,
    summarizeLogs: summarizePersistedApplicationLogs
}) {
    app.get('/api/v1/admin/logs', async function handleGetLogs(request, reply) {
        const query = request.query;
        const levels = parseLevels(query.levels);
        const limit = parseLimit(query.limit);
        const range = parseRange(query.range);
        const since = range ? new Date(Date.now() - (range.minutes * 60 * 1000)).toISOString() : undefined;
        try {
            const entries = await dependencies.listLogs({
                search: query.q,
                levels,
                limit,
                since
            });
            return {
                filters: {
                    q: (query.q || '').trim(),
                    levels,
                    limit,
                    range: range ? range.value : 'all'
                },
                totals: {
                    stored: await dependencies.summarizeLogs(),
                    filtered: summarizeEntries(entries)
                },
                entries: entries.map(serializeEntry)
            };
        }
        catch (error) {
            reply.code(503);
            return {
                message: getLogAccessErrorMessage(error)
            };
        }
    });
}
function parseLevels(value) {
    const validLevels = ['info', 'warn', 'error'];
    const parsedLevels = (value || '')
        .split(',')
        .map(function mapLevel(level) {
        return level.trim().toLowerCase();
    })
        .filter(function filterLevel(level) {
        return validLevels.includes(level);
    });
    return parsedLevels.length ? parsedLevels : validLevels;
}
function parseLimit(value) {
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numericValue)) {
        return 200;
    }
    return Math.max(1, Math.min(Math.floor(numericValue), 500));
}
function parseRange(value) {
    if (value === '30m') {
        return {
            value: '30m',
            minutes: 30
        };
    }
    if (value === '2h') {
        return {
            value: '2h',
            minutes: 120
        };
    }
    if (value === '1d') {
        return {
            value: '1d',
            minutes: 1440
        };
    }
    if (value === '1w') {
        return {
            value: '1w',
            minutes: 10080
        };
    }
    return null;
}
function summarizeEntries(entries) {
    return entries.reduce(function reduceSummary(summary, entry) {
        summary[entry.level] += 1;
        return summary;
    }, {
        info: 0,
        warn: 0,
        error: 0
    });
}
function serializeEntry(entry) {
    return {
        id: entry.id,
        timestamp: entry.timestamp,
        level: entry.level,
        scope: entry.scope,
        event: entry.event,
        message: entry.message,
        context: entry.context
    };
}
function getLogAccessErrorMessage(error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    if (normalized.includes('application logs are not ready yet') ||
        normalized.includes('does not exist') ||
        normalized.includes('findmany')) {
        return 'Application logs are not ready yet. Apply the latest database migration and restart the backend, then refresh this page.';
    }
    return 'Application logs are currently unavailable.';
}
