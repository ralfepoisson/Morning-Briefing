import { appendApplicationLog } from './application-log-store.js';
import { persistApplicationLog } from './application-log-repository.js';
export function logApplicationEvent(input) {
    const entry = appendApplicationLog({
        timestamp: new Date().toISOString(),
        level: input.level,
        scope: input.scope,
        event: input.event,
        message: input.message || input.event,
        context: input.context || {}
    });
    writeToConsole(entry);
    void persistApplicationLog(entry).catch(function handleLogPersistenceError(error) {
        console.warn(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'warn',
            scope: 'application-logger',
            event: 'application_log_persist_failed',
            message: 'Application log could not be persisted.',
            originalEvent: entry.event,
            originalScope: entry.scope,
            error: error instanceof Error ? error.message : String(error)
        }));
        return undefined;
    });
    return entry;
}
export function toLogErrorContext(error) {
    if (error instanceof Error) {
        return {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack || null
        };
    }
    return {
        errorName: 'UnknownError',
        errorMessage: String(error),
        errorStack: null
    };
}
function writeToConsole(entry) {
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
