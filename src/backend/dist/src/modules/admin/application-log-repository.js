import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { filterApplicationLogs, summarizeEntries } from './application-log-store.js';
export async function persistApplicationLog(entry, prisma = getPrismaClient()) {
    await getApplicationLogEventDelegate(prisma).upsert({
        where: {
            id: entry.id
        },
        update: {},
        create: {
            id: entry.id,
            timestamp: new Date(entry.timestamp),
            level: toPrismaLevel(entry.level),
            scope: entry.scope,
            event: entry.event,
            message: entry.message,
            contextJson: entry.context
        }
    });
}
export async function listPersistedApplicationLogs(filters = {}, prisma = getPrismaClient()) {
    const rows = await getApplicationLogEventDelegate(prisma).findMany({
        orderBy: {
            timestamp: 'desc'
        },
        take: 5000
    });
    return filterApplicationLogs(rows.map(mapRowToEntry), filters);
}
export async function summarizePersistedApplicationLogs(prisma = getPrismaClient()) {
    const rows = await getApplicationLogEventDelegate(prisma).groupBy({
        by: ['level'],
        _count: {
            _all: true
        }
    });
    const summary = summarizeEntries([]);
    rows.forEach(function applyRow(row) {
        summary[fromPrismaLevel(row.level)] = row._count._all;
    });
    return summary;
}
function mapRowToEntry(row) {
    return {
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        level: fromPrismaLevel(row.level),
        scope: row.scope,
        event: row.event,
        message: row.message,
        context: isRecord(row.contextJson) ? row.contextJson : {}
    };
}
function toPrismaLevel(level) {
    if (level === 'error') {
        return 'ERROR';
    }
    if (level === 'warn') {
        return 'WARN';
    }
    return 'INFO';
}
function fromPrismaLevel(level) {
    if (level === 'ERROR') {
        return 'error';
    }
    if (level === 'WARN') {
        return 'warn';
    }
    return 'info';
}
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function getApplicationLogEventDelegate(prisma) {
    if (!prisma || !prisma.applicationLogEvent) {
        throw new Error('Application logs are not ready yet. Apply the latest database migration, regenerate Prisma if needed, and restart the backend.');
    }
    return prisma.applicationLogEvent;
}
