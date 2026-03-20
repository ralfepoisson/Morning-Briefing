export type ApplicationLogLevel = 'info' | 'warn' | 'error';

export type ApplicationLogEntry = {
  id: string;
  timestamp: string;
  level: ApplicationLogLevel;
  scope: string;
  event: string;
  message: string;
  context: Record<string, unknown>;
};

export type ApplicationLogFilters = {
  search?: string;
  levels?: ApplicationLogLevel[];
  limit?: number;
  since?: string;
};

const MAX_LOG_ENTRIES = 500;
const logEntries: ApplicationLogEntry[] = [];

export function appendApplicationLog(entry: Omit<ApplicationLogEntry, 'id'>): ApplicationLogEntry {
  const storedEntry: ApplicationLogEntry = {
    id: createLogId(),
    ...entry
  };

  logEntries.push(storedEntry);

  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.splice(0, logEntries.length - MAX_LOG_ENTRIES);
  }

  return storedEntry;
}

export function listApplicationLogs(filters: ApplicationLogFilters = {}): ApplicationLogEntry[] {
  return filterApplicationLogs(logEntries, filters);
}

export function filterApplicationLogs(entries: ApplicationLogEntry[], filters: ApplicationLogFilters = {}): ApplicationLogEntry[] {
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
    .slice()
    .reverse()
    .slice(0, limit);
}

export function summarizeApplicationLogs(): Record<ApplicationLogLevel, number> {
  return summarizeEntries(logEntries);
}

export function summarizeEntries(entries: ApplicationLogEntry[]): Record<ApplicationLogLevel, number> {
  return entries.reduce<Record<ApplicationLogLevel, number>>(function reduceSummary(summary, entry) {
    summary[entry.level] += 1;
    return summary;
  }, {
    info: 0,
    warn: 0,
    error: 0
  });
}

export function resetApplicationLogs(): void {
  logEntries.splice(0, logEntries.length);
}

function buildSearchableText(entry: ApplicationLogEntry): string {
  return [
    entry.timestamp,
    entry.level,
    entry.scope,
    entry.event,
    entry.message,
    JSON.stringify(entry.context)
  ].join(' ').toLowerCase();
}

function normalizeSearch(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function createLogId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
