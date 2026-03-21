import { createNightlyRefreshService } from './snapshot-runtime.js';
export async function handleNightlyRefresh() {
    const service = createNightlyRefreshService();
    return service.enqueueDueWidgets();
}
