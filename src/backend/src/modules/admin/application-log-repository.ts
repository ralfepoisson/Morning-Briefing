import type { ApplicationLogLevel as PrismaApplicationLogLevel, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import {
  filterApplicationLogs,
  summarizeEntries,
  type ApplicationLogEntry,
  type ApplicationLogFilters,
  type ApplicationLogLevel
} from './application-log-store.js';

type ApplicationLogEventClient = Pick<PrismaClient, 'applicationLogEvent'>;

export async function persistApplicationLog(
  entry: ApplicationLogEntry,
  prisma: ApplicationLogEventClient = getPrismaClient()
): Promise<void> {
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

export async function listPersistedApplicationLogs(
  filters: ApplicationLogFilters = {},
  prisma: ApplicationLogEventClient = getPrismaClient()
): Promise<ApplicationLogEntry[]> {
  const rows = await getApplicationLogEventDelegate(prisma).findMany({
    orderBy: {
      timestamp: 'desc'
    },
    take: 5000
  });

  return filterApplicationLogs(rows.map(mapRowToEntry), filters);
}

export async function summarizePersistedApplicationLogs(
  prisma: ApplicationLogEventClient = getPrismaClient()
): Promise<Record<ApplicationLogLevel, number>> {
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

function mapRowToEntry(row: {
  id: string;
  timestamp: Date;
  level: PrismaApplicationLogLevel;
  scope: string;
  event: string;
  message: string;
  contextJson: unknown;
}): ApplicationLogEntry {
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

function toPrismaLevel(level: ApplicationLogLevel): PrismaApplicationLogLevel {
  if (level === 'error') {
    return 'ERROR';
  }

  if (level === 'warn') {
    return 'WARN';
  }

  return 'INFO';
}

function fromPrismaLevel(level: PrismaApplicationLogLevel): ApplicationLogLevel {
  if (level === 'ERROR') {
    return 'error';
  }

  if (level === 'WARN') {
    return 'warn';
  }

  return 'info';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getApplicationLogEventDelegate(prisma: ApplicationLogEventClient) {
  if (!prisma || !prisma.applicationLogEvent) {
    throw new Error(
      'Application logs are not ready yet. Apply the latest database migration, regenerate Prisma if needed, and restart the backend.'
    );
  }

  return prisma.applicationLogEvent;
}
