import { formatSnapshotDateForTimezone } from './snapshot-date.js';
import { logSnapshotJob } from './snapshot-job-logger.js';
export class NightlyRefreshService {
    repository;
    publisher;
    constructor(repository, publisher) {
        this.repository = repository;
        this.publisher = publisher;
    }
    async enqueueDueWidgets(now = new Date()) {
        const widgets = await this.repository.listWidgetsForScheduledRefresh();
        let enqueuedCount = 0;
        for (const widget of widgets) {
            const snapshotDate = formatSnapshotDateForTimezone(now, 'UTC');
            await this.publisher.publishGenerateWidgetSnapshot({
                widgetId: widget.id,
                dashboardId: widget.dashboardId,
                tenantId: widget.tenantId,
                userId: widget.ownerUserId,
                widgetConfigVersion: widget.version,
                widgetConfigHash: widget.configHash,
                snapshotDate,
                triggerSource: 'scheduled_refresh'
            });
            enqueuedCount += 1;
        }
        logSnapshotJob('info', 'nightly_refresh_enqueue_completed', {
            enqueuedCount,
            widgetCount: widgets.length
        });
        return {
            enqueuedCount
        };
    }
}
