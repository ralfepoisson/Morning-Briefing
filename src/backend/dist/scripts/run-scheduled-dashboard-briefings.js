import 'dotenv/config';
import { createScheduledDashboardBriefingRefreshService } from '../src/modules/dashboard-briefings/dashboard-briefing-runtime.js';
const service = createScheduledDashboardBriefingRefreshService();
if (!service) {
    throw new Error('Dashboard briefing scheduling requires the snapshot queue to be enabled.');
}
const result = await service.enqueueAllDashboards();
console.log(JSON.stringify({
    event: 'scheduled_dashboard_briefing_run_completed',
    enqueuedCount: result.enqueuedCount,
    skippedDisabledCount: result.skippedDisabledCount,
    skippedGeneratingCount: result.skippedGeneratingCount
}));
