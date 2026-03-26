import { describeFetchFailure } from '../../shared/fetch-error.js';
export class GmailClientImpl {
    async listMessages(accessToken, filters) {
        const normalizedFilters = filters.filter(function filterValue(value) {
            return typeof value === 'string' && value.trim();
        }).map(function mapValue(value) {
            return value.trim();
        });
        const uniqueMessages = new Map();
        for (const filter of normalizedFilters) {
            const messageRefs = await this.listMessageRefs(accessToken, filter);
            for (const messageRef of messageRefs) {
                if (uniqueMessages.has(messageRef.id)) {
                    uniqueMessages.get(messageRef.id)?.matchedFilters.push(filter);
                    continue;
                }
                const message = await this.getMessage(accessToken, messageRef.id);
                uniqueMessages.set(message.id, {
                    ...message,
                    matchedFilters: [filter]
                });
            }
        }
        return Array.from(uniqueMessages.values()).sort(function sortDescending(left, right) {
            return Date.parse(right.receivedAt) - Date.parse(left.receivedAt);
        });
    }
    async listMessageRefs(accessToken, filter) {
        const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
        url.searchParams.set('maxResults', '10');
        url.searchParams.set('q', filter);
        let response;
        try {
            response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
        }
        catch (error) {
            throw new Error(describeFetchFailure('Gmail message list request', url, error));
        }
        if (!response.ok) {
            throw new Error(`Gmail message list request failed with status ${response.status}.`);
        }
        const payload = await response.json();
        if (!payload.messages) {
            return [];
        }
        return payload.messages.map(function mapItem(item) {
            return {
                id: typeof item.id === 'string' ? item.id : ''
            };
        }).filter(function filterItem(item) {
            return !!item.id;
        });
    }
    async getMessage(accessToken, messageId) {
        const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`);
        url.searchParams.set('format', 'metadata');
        url.searchParams.append('metadataHeaders', 'Subject');
        url.searchParams.append('metadataHeaders', 'From');
        let response;
        try {
            response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
        }
        catch (error) {
            throw new Error(describeFetchFailure('Gmail message request', url, error));
        }
        if (!response.ok) {
            throw new Error(`Gmail message request failed with status ${response.status}.`);
        }
        const payload = await response.json();
        const headers = Array.isArray(payload.payload?.headers) ? payload.payload?.headers || [] : [];
        return {
            id: typeof payload.id === 'string' ? payload.id : messageId,
            threadId: typeof payload.threadId === 'string' ? payload.threadId : '',
            subject: readHeader(headers, 'subject') || 'No subject',
            from: readHeader(headers, 'from') || 'Unknown sender',
            snippet: typeof payload.snippet === 'string' ? payload.snippet : '',
            receivedAt: normalizeInternalDate(payload.internalDate),
            isUnread: Array.isArray(payload.labelIds) && payload.labelIds.includes('UNREAD'),
            webUrl: `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(messageId)}`
        };
    }
}
function readHeader(headers, targetName) {
    const header = headers.find(function findHeader(item) {
        return typeof item.name === 'string' && item.name.toLowerCase() === targetName;
    });
    return typeof header?.value === 'string' ? header.value.trim() : '';
}
function normalizeInternalDate(value) {
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
            return new Date(parsed).toISOString();
        }
    }
    return new Date(0).toISOString();
}
