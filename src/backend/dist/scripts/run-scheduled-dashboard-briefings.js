import 'dotenv/config';
import { createScheduledDashboardBriefingRefreshRuntime } from '../src/modules/dashboard-briefings/dashboard-briefing-runtime.js';
const runtime = createScheduledDashboardBriefingRefreshRuntime();
if (!runtime) {
    throw new Error('Dashboard briefing scheduling requires the snapshot queue to be enabled.');
}
const result = await runScheduledDashboardBriefings(runtime);
console.log(JSON.stringify({
    event: 'scheduled_dashboard_briefing_run_completed',
    enqueuedCount: result.enqueuedCount,
    skippedDisabledCount: result.skippedDisabledCount,
    skippedGeneratingCount: result.skippedGeneratingCount
}));
async function runScheduledDashboardBriefings(scheduledRuntime) {
    try {
        return await scheduledRuntime.service.enqueueAllDashboards();
    }
    finally {
        await scheduledRuntime.close();
    }
}
