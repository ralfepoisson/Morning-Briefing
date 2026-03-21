export function describeFetchFailure(operation, requestUrl, error) {
    const target = getTargetLabel(requestUrl);
    const detail = extractFetchErrorDetail(error);
    if (detail) {
        return `${operation} failed before receiving a response from ${target}: ${detail}.`;
    }
    return `${operation} failed before receiving a response from ${target}.`;
}
function getTargetLabel(requestUrl) {
    try {
        const parsed = requestUrl instanceof URL ? requestUrl : new URL(String(requestUrl));
        return parsed.origin;
    }
    catch {
        return String(requestUrl);
    }
}
function extractFetchErrorDetail(error) {
    const messages = [];
    let current = error;
    let depth = 0;
    while (current && depth < 4) {
        if (typeof current === 'object') {
            const candidate = current;
            const message = typeof candidate.message === 'string' ? candidate.message.trim() : '';
            const code = typeof candidate.code === 'string' ? candidate.code.trim() : '';
            const errno = typeof candidate.errno === 'string' ? candidate.errno.trim() : '';
            const combined = [code || errno, message].filter(Boolean).join(' ');
            if (combined && !isGenericFetchMessage(message)) {
                messages.push(combined);
            }
            current = candidate.cause;
            depth += 1;
            continue;
        }
        if (typeof current === 'string' && current.trim() && !isGenericFetchMessage(current)) {
            messages.push(current.trim());
        }
        break;
    }
    return messages[0] || '';
}
function isGenericFetchMessage(message) {
    const normalized = message.trim().toLowerCase();
    return normalized === 'fetch failed' || normalized === 'failed to fetch';
}
