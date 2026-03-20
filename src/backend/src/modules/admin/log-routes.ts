import type { FastifyInstance } from 'fastify';
import {
  type ApplicationLogEntry,
  type ApplicationLogLevel
} from './application-log-store.js';
import {
  listPersistedApplicationLogs,
  summarizePersistedApplicationLogs
} from './application-log-repository.js';

type LogRouteDependencies = {
  listLogs: typeof listPersistedApplicationLogs;
  summarizeLogs: typeof summarizePersistedApplicationLogs;
};

export async function registerLogRoutes(
  app: FastifyInstance,
  dependencies: LogRouteDependencies = {
    listLogs: listPersistedApplicationLogs,
    summarizeLogs: summarizePersistedApplicationLogs
  }
): Promise<void> {
  app.get('/api/v1/admin/logs', async function handleGetLogs(request, reply) {
    const query = request.query as {
      q?: string;
      levels?: string;
      limit?: string | number;
      range?: string;
    };
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
    } catch (error) {
      reply.code(503);
      return {
        message: getLogAccessErrorMessage(error)
      };
    }
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

function parseRange(value?: string): {
  value: '30m' | '2h' | '1d' | '1w';
  minutes: number;
} | null {
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

function getLogAccessErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('application logs are not ready yet') ||
    normalized.includes('does not exist') ||
    normalized.includes('findmany')
  ) {
    return 'Application logs are not ready yet. Apply the latest database migration and restart the backend, then refresh this page.';
  }

  return 'Application logs are currently unavailable.';
}
