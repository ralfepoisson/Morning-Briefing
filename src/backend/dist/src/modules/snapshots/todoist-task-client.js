import { describeFetchFailure } from '../../shared/fetch-error.js';
export class TodoistTaskClientImpl {
    async listTasks(apiKey) {
        const tasks = [];
        let nextCursor = null;
        do {
            const url = new URL('https://api.todoist.com/api/v1/tasks');
            if (nextCursor) {
                url.searchParams.set('cursor', nextCursor);
            }
            let response;
            try {
                response = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${apiKey}`
                    }
                });
            }
            catch (error) {
                throw new Error(describeFetchFailure('Todoist request', url, error));
            }
            if (!response.ok) {
                throw new Error(`Todoist request failed with status ${response.status}.`);
            }
            const payload = await response.json();
            if (!payload || !Array.isArray(payload.results)) {
                throw new Error('Todoist returned an invalid task payload.');
            }
            tasks.push(...payload.results.map(mapTask));
            nextCursor = typeof payload.next_cursor === 'string' && payload.next_cursor.trim()
                ? payload.next_cursor
                : null;
        } while (nextCursor);
        return tasks;
    }
}
function mapTask(item) {
    return {
        id: typeof item.id === 'string' ? item.id : String(item.id),
        content: typeof item.content === 'string' ? item.content : 'Untitled task',
        description: typeof item.description === 'string' ? item.description : '',
        url: typeof item.url === 'string' ? item.url : '',
        due: item && typeof item === 'object' && item.due && typeof item.due === 'object'
            ? {
                date: typeof item.due.date === 'string' ? item.due.date : '',
                string: typeof item.due.string === 'string' ? item.due.string : '',
                isRecurring: Boolean(item.due.is_recurring ?? item.due.isRecurring)
            }
            : null
    };
}
