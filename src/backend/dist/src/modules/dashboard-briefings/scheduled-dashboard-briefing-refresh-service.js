import { logApplicationEvent } from '../admin/application-logger.js';
export class ScheduledDashboardBriefingRefreshService {
    repository;
    publisher;
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
        for (const dashboard of dashboards) {
            if (dashboard.isGenerating) {
                skippedGeneratingCount += 1;
                continue;
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
                dashboardCount: dashboards.length
            }
        });
        return {
            enqueuedCount,
            skippedDisabledCount,
            skippedGeneratingCount,
            skippedMissingSnapshotsCount
        };
    }
}
