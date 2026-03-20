import type { FastifyInstance } from 'fastify';
import {
  listApplicationLogs,
  summarizeApplicationLogs,
  type ApplicationLogEntry,
  type ApplicationLogLevel
} from './application-log-store.js';

type LogRouteDependencies = {
  listLogs: typeof listApplicationLogs;
  summarizeLogs: typeof summarizeApplicationLogs;
};

export async function registerLogRoutes(
  app: FastifyInstance,
  dependencies: LogRouteDependencies = {
    listLogs: listApplicationLogs,
    summarizeLogs: summarizeApplicationLogs
  }
): Promise<void> {
  app.get('/api/v1/admin/logs', async function handleGetLogs(request) {
    const query = request.query as {
      q?: string;
      levels?: string;
      limit?: string | number;
    };
    const levels = parseLevels(query.levels);
    const limit = parseLimit(query.limit);
    const entries = dependencies.listLogs({
      search: query.q,
      levels,
      limit
    });

    return {
      filters: {
        q: (query.q || '').trim(),
        levels,
        limit
      },
      totals: {
        stored: dependencies.summarizeLogs(),
        filtered: summarizeEntries(entries)
      },
      entries: entries.map(serializeEntry)
    };
  });
}

function parseLevels(value?: string): ApplicationLogLevel[] {
  const validLevels: ApplicationLogLevel[] = ['info', 'warn', 'error'];
  const parsedLevels = (value || '')
    .split(',')
    .map(function mapLevel(level) {
      return level.trim().toLowerCase();
    })
    .filter(function filterLevel(level): level is ApplicationLogLevel {
      return validLevels.includes(level as ApplicationLogLevel);
    });

  return parsedLevels.length ? parsedLevels : validLevels;
}

function parseLimit(value?: string | number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return 200;
  }

  return Math.max(1, Math.min(Math.floor(numericValue), 500));
}

function summarizeEntries(entries: ApplicationLogEntry[]): Record<ApplicationLogLevel, number> {
  return entries.reduce<Record<ApplicationLogLevel, number>>(function reduceSummary(summary, entry) {
    summary[entry.level] += 1;
    return summary;
  }, {
    info: 0,
    warn: 0,
    error: 0
  });
}

function serializeEntry(entry: ApplicationLogEntry) {
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
