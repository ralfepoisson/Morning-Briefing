import { createScheduledDashboardBriefingRefreshService } from '../dashboard-briefings/dashboard-briefing-runtime.js';
import { logApplicationEvent } from '../admin/application-logger.js';
import { createNightlyRefreshService } from '../snapshots/snapshot-runtime.js';
import { getNextDailyUtcRunAt } from './daily-utc-scheduler.js';
let started = false;
export function isLocalDevSchedulerEnabled(env = process.env) {
    return env.LOCAL_SCHEDULER_ENABLED === 'true' && env.NODE_ENV !== 'production';
}
export function startLocalDevScheduler() {
    if (started) {
        return;
    }
    const dashboardBriefingRefreshService = createScheduledDashboardBriefingRefreshService();
    if (!dashboardBriefingRefreshService) {
        logApplicationEvent({
            level: 'warn',
            scope: 'scheduler',
            event: 'local_scheduler_not_started',
            message: 'Local scheduler was not started because queue publishing is unavailable.'
        });
        return;
    }
    const snapshotRefreshService = createNightlyRefreshService();
    const jobs = [
        {
            name: 'widget snapshots',
            hour: 1,
            minute: 0,
            async run() {
                const result = await snapshotRefreshService.enqueueDueWidgets();
                logApplicationEvent({
                    level: 'info',
                    scope: 'scheduler',
                    event: 'local_scheduler_widget_snapshots_completed',
                    message: 'Local scheduler widget snapshot refresh completed.',
                    context: {
                        enqueuedCount: result.enqueuedCount
                    }
                });
            }
        },
        {
            name: 'dashboard audio briefings',
            hour: 5,
            minute: 0,
            async run() {
                const result = await dashboardBriefingRefreshService.enqueueAllDashboards();
                logApplicationEvent({
                    level: 'info',
                    scope: 'scheduler',
                    event: 'local_scheduler_dashboard_audio_completed',
                    message: 'Local scheduler dashboard audio refresh completed.',
                    context: {
                        enqueuedCount: result.enqueuedCount,
                        skippedDisabledCount: result.skippedDisabledCount,
                        skippedGeneratingCount: result.skippedGeneratingCount
                    }
                });
            }
        }
    ];
    started = true;
    for (const job of jobs) {
        scheduleNextRun(job);
    }
    logApplicationEvent({
        level: 'info',
        scope: 'scheduler',
        event: 'local_scheduler_started',
        message: 'Local scheduler started.',
        context: {
            jobs: jobs.map(function mapJob(job) {
                return {
                    name: job.name,
                    timeUtc: `${String(job.hour).padStart(2, '0')}:${String(job.minute).padStart(2, '0')}`
                };
            })
        }
    });
}
function scheduleNextRun(job) {
    const now = new Date();
    const nextRun = getNextDailyUtcRunAt(now, job.hour, job.minute);
    const delayMs = Math.max(nextRun.getTime() - now.getTime(), 0);
    logApplicationEvent({
        level: 'info',
        scope: 'scheduler',
        event: 'local_scheduler_job_scheduled',
        message: 'Local scheduler job scheduled.',
        context: {
            jobName: job.name,
            nextRunAt: nextRun.toISOString()
        }
    });
    setTimeout(async function runScheduledJob() {
        try {
            await job.run();
        }
        catch (error) {
            logApplicationEvent({
                level: 'error',
                scope: 'scheduler',
                event: 'local_scheduler_job_failed',
                message: error instanceof Error ? error.message : 'Local scheduler job failed.',
                context: {
                    jobName: job.name
                }
            });
        }
        finally {
            scheduleNextRun(job);
        }
    }, delayMs);
}
