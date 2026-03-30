import { logApplicationEvent } from '../admin/application-logger.js';
export class ScheduledDashboardBriefingRefreshService {
    repository;
    publisher;
    static STALE_GENERATING_THRESHOLD_MS = 30 * 60 * 1000;
    constructor(repository, publisher) {
        this.repository = repository;
        this.publisher = publisher;
    }
    async enqueueAllDashboards(now = new Date()) {
        const dashboards = await this.repository.listDashboardsForScheduledGeneration();
        let enqueuedCount = 0;
        let skippedDisabledCount = 0;
        let skippedGeneratingCount = 0;
        let skippedMissingSnapshotsCount = 0;
        let recoveredStaleGeneratingCount = 0;
        for (const dashboard of dashboards) {
            if (dashboard.isGenerating) {
                if (isStaleGeneratingDashboard(dashboard, now)) {
                    await this.repository.setDashboardGenerating(dashboard.id, dashboard.owner.id, false);
                    recoveredStaleGeneratingCount += 1;
                    logApplicationEvent({
                        level: 'warn',
                        scope: 'dashboard-briefing',
                        event: 'scheduled_dashboard_briefing_stale_generating_reset',
                        message: 'Recovered a dashboard briefing stuck in generating state before scheduled enqueue.',
                        context: {
                            dashboardId: dashboard.id,
                            ownerUserId: dashboard.owner.id,
                            latestBriefingStatus: dashboard.latestBriefing ? dashboard.latestBriefing.status : null,
                            latestBriefingUpdatedAt: dashboard.latestBriefing ? dashboard.latestBriefing.updatedAt.toISOString() : null
                        }
                    });
                }
                else {
                    skippedGeneratingCount += 1;
                    continue;
                }
            }
            if (dashboard.briefingPreference && dashboard.briefingPreference.enabled === false) {
                skippedDisabledCount += 1;
                continue;
            }
            if (!dashboard.hasReadySnapshot) {
                skippedMissingSnapshotsCount += 1;
                continue;
            }
            await this.publisher.publishGenerateDashboardAudioBriefing({
                dashboardId: dashboard.id,
                tenantId: dashboard.tenantId,
                ownerUserId: dashboard.owner.id,
                ownerDisplayName: dashboard.owner.displayName,
                ownerPhoneticName: dashboard.owner.phoneticName,
                ownerTimezone: dashboard.owner.timezone,
                ownerLocale: dashboard.owner.locale,
                ownerEmail: dashboard.owner.email,
                ownerIsAdmin: dashboard.owner.isAdmin,
                force: true,
                requestedAt: now,
                correlationId: null,
                causationId: null
            });
            enqueuedCount += 1;
        }
        logApplicationEvent({
            level: 'info',
            scope: 'dashboard-briefing',
            event: 'scheduled_dashboard_briefing_enqueue_completed',
            message: 'Scheduled dashboard audio briefing enqueue completed.',
            context: {
                enqueuedCount,
                skippedDisabledCount,
                skippedGeneratingCount,
                skippedMissingSnapshotsCount,
                recoveredStaleGeneratingCount,
                dashboardCount: dashboards.length
            }
        });
        return {
            enqueuedCount,
            skippedDisabledCount,
            skippedGeneratingCount,
            skippedMissingSnapshotsCount,
            recoveredStaleGeneratingCount
        };
    }
}
function isStaleGeneratingDashboard(dashboard, now) {
    if (!dashboard.latestBriefing) {
        return true;
    }
    if (dashboard.latestBriefing.status !== 'GENERATING') {
        return true;
    }
    return now.getTime() - dashboard.latestBriefing.updatedAt.getTime() >=
        ScheduledDashboardBriefingRefreshService.STALE_GENERATING_THRESHOLD_MS;
}
