import {
  appendApplicationLog,
  type ApplicationLogEntry,
  type ApplicationLogLevel
} from './application-log-store.js';
import { persistApplicationLog } from './application-log-repository.js';

export function logApplicationEvent(input: {
  level: ApplicationLogLevel;
  scope: string;
  event: string;
  message?: string;
  context?: Record<string, unknown>;
}): ApplicationLogEntry {
  const entry = appendApplicationLog({
    timestamp: new Date().toISOString(),
    level: input.level,
    scope: input.scope,
    event: input.event,
    message: input.message || input.event,
    context: input.context || {}
  });

  writeToConsole(entry);
  void persistApplicationLog(entry).catch(function ignoreLogPersistenceError() {
    return undefined;
  });

  return entry;
}

function writeToConsole(entry: ApplicationLogEntry): void {
  const line = JSON.stringify({
    timestamp: entry.timestamp,
    level: entry.level,
    scope: entry.scope,
    event: entry.event,
    message: entry.message,
    ...entry.context
  });

  if (entry.level === 'error') {
    console.error(line);
    return;
  }

  if (entry.level === 'warn') {
    console.warn(line);
    return;
  }

  console.info(line);
}
