import 'dotenv/config';
import { createScheduledDashboardBriefingRefreshService } from '../src/modules/dashboard-briefings/dashboard-briefing-runtime.js';
import { createNightlyRefreshService } from '../src/modules/snapshots/snapshot-runtime.js';
import { getNextDailyUtcRunAt } from '../src/modules/scheduling/daily-utc-scheduler.js';

type ScheduledJob = {
  name: string;
  hour: number;
  minute: number;
  run: () => Promise<void>;
};

const snapshotRefreshService = createNightlyRefreshService();
const dashboardBriefingRefreshService = createScheduledDashboardBriefingRefreshService();

if (!dashboardBriefingRefreshService) {
  throw new Error('Local scheduling requires the snapshot queue to be enabled.');
}

const jobs: ScheduledJob[] = [
  {
    name: 'widget snapshots',
    hour: 1,
    minute: 0,
    async run() {
      const result = await snapshotRefreshService.enqueueDueWidgets();
      console.log(JSON.stringify({
        event: 'local_scheduler_widget_snapshots_completed',
        enqueuedCount: result.enqueuedCount
      }));
    }
  },
  {
    name: 'dashboard audio briefings',
    hour: 5,
    minute: 0,
    async run() {
      const result = await dashboardBriefingRefreshService.enqueueAllDashboards();
      console.log(JSON.stringify({
        event: 'local_scheduler_dashboard_audio_completed',
        enqueuedCount: result.enqueuedCount,
        skippedDisabledCount: result.skippedDisabledCount,
        skippedGeneratingCount: result.skippedGeneratingCount
      }));
    }
  }
];

for (const job of jobs) {
  scheduleNextRun(job);
}

console.log(JSON.stringify({
  event: 'local_scheduler_started',
  jobs: jobs.map(function mapJob(job) {
    return {
      name: job.name,
      timeUtc: `${String(job.hour).padStart(2, '0')}:${String(job.minute).padStart(2, '0')}`
    };
  })
}));

function scheduleNextRun(job: ScheduledJob): void {
  const now = new Date();
  const nextRun = getNextDailyUtcRunAt(now, job.hour, job.minute);
  const delayMs = Math.max(nextRun.getTime() - now.getTime(), 0);

  console.log(JSON.stringify({
    event: 'local_scheduler_job_scheduled',
    jobName: job.name,
    nextRunAt: nextRun.toISOString()
  }));

  setTimeout(async function runScheduledJob() {
    try {
      await job.run();
    } catch (error) {
      console.error(JSON.stringify({
        event: 'local_scheduler_job_failed',
        jobName: job.name,
        message: error instanceof Error ? error.message : 'Scheduled job failed.'
      }));
    } finally {
      scheduleNextRun(job);
    }
  }, delayMs);
}
