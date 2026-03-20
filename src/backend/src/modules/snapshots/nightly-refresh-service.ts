import { formatSnapshotDateForTimezone } from './snapshot-date.js';
import { logSnapshotJob } from './snapshot-job-logger.js';
import type { SnapshotJobPublisher } from './snapshot-job-publisher.js';
import type { SnapshotRepository } from './snapshot-repository.js';

export class NightlyRefreshService {
  constructor(
    private readonly repository: Pick<SnapshotRepository, 'listWidgetsForScheduledRefresh'>,
    private readonly publisher: SnapshotJobPublisher
  ) {}

  async enqueueDueWidgets(now: Date = new Date()): Promise<{ enqueuedCount: number }> {
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
