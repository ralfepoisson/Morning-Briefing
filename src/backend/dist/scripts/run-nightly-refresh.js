import 'dotenv/config';
import { createNightlyRefreshService } from '../src/modules/snapshots/snapshot-runtime.js';
const service = createNightlyRefreshService();
const result = await service.enqueueDueWidgets();
console.log(JSON.stringify({
    event: 'nightly_refresh_run_completed',
    enqueuedCount: result.enqueuedCount
}));
