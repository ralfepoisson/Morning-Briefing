import 'dotenv/config';
import { createNightlyRefreshRuntime } from '../src/modules/snapshots/snapshot-runtime.js';
const result = await runNightlyRefresh();
console.log(JSON.stringify({
    event: 'nightly_refresh_run_completed',
    enqueuedCount: result.enqueuedCount
}));
async function runNightlyRefresh() {
    const runtime = createNightlyRefreshRuntime();
    try {
        return await runtime.service.enqueueDueWidgets();
    }
    finally {
        await runtime.close();
    }
}
