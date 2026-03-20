import { mkdir, appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  filterApplicationLogs,
  summarizeEntries,
  type ApplicationLogEntry,
  type ApplicationLogFilters,
  type ApplicationLogLevel
} from './application-log-store.js';

const DEFAULT_LOG_FILE = path.resolve(process.cwd(), 'data', 'application.log.ndjson');

export async function appendApplicationLogToFile(
  entry: ApplicationLogEntry,
  filePath: string = getApplicationLogFilePath()
): Promise<void> {
  await mkdir(path.dirname(filePath), {
    recursive: true
  });
  await appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

export async function listPersistedApplicationLogs(
  filters: ApplicationLogFilters = {},
  filePath: string = getApplicationLogFilePath()
): Promise<ApplicationLogEntry[]> {
  const entries = await readApplicationLogFile(filePath);
  return filterApplicationLogs(entries, filters);
}

export async function summarizePersistedApplicationLogs(
  filePath: string = getApplicationLogFilePath()
): Promise<Record<ApplicationLogLevel, number>> {
  return summarizeEntries(await readApplicationLogFile(filePath));
}

export function getApplicationLogFilePath(): string {
  return process.env.APPLICATION_LOG_FILE || DEFAULT_LOG_FILE;
}

async function readApplicationLogFile(filePath: string): Promise<ApplicationLogEntry[]> {
  try {
    const contents = await readFile(filePath, 'utf8');

    return contents
      .split('\n')
      .map(function parseLine(line) {
        return line.trim();
      })
      .filter(Boolean)
      .map(function mapLine(line) {
        try {
          const parsed = JSON.parse(line) as Partial<ApplicationLogEntry>;

          if (!isApplicationLogEntry(parsed)) {
            return null;
          }

          return parsed;
        } catch {
          return null;
        }
      })
      .filter(function filterEntry(entry): entry is ApplicationLogEntry {
        return entry !== null;
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('ENOENT')) {
      return [];
    }

    throw error;
  }
}

function isApplicationLogEntry(value: Partial<ApplicationLogEntry>): value is ApplicationLogEntry {
  return (
    typeof value.id === 'string' &&
    typeof value.timestamp === 'string' &&
    (value.level === 'info' || value.level === 'warn' || value.level === 'error') &&
    typeof value.scope === 'string' &&
    typeof value.event === 'string' &&
    typeof value.message === 'string' &&
    !!value.context &&
    typeof value.context === 'object' &&
    !Array.isArray(value.context)
  );
}
