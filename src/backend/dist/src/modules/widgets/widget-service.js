import { formatSnapshotDateForTimezone } from '../snapshots/snapshot-date.js';
export class WidgetService {
    repository;
    snapshotJobPublisher;
    constructor(repository, snapshotJobPublisher = null) {
        this.repository = repository;
        this.snapshotJobPublisher = snapshotJobPublisher;
    }
    async listForDashboard(dashboardId, ownerUserId) {
        const widgets = await this.repository.listForDashboard(dashboardId, ownerUserId);
        return widgets.map(toResponse);
    }
    async create(input) {
        const widget = await this.repository.create(input);
        if (this.snapshotJobPublisher) {
            await this.snapshotJobPublisher.publishGenerateWidgetSnapshot({
                widgetId: widget.id,
                dashboardId: widget.dashboardId,
                tenantId: widget.tenantId,
                userId: widget.ownerUserId,
                widgetConfigVersion: widget.version,
                widgetConfigHash: widget.configHash,
                snapshotDate: formatSnapshotDateForTimezone(new Date(), input.timezone || 'UTC'),
                triggerSource: 'config_updated',
                correlationId: input.correlationId || null,
                causationId: input.causationId || null
            });
        }
        return toResponse(widget);
    }
    async update(input) {
        const widget = await this.repository.update(input);
        if (widget && widget.shouldRefreshSnapshot && this.snapshotJobPublisher) {
            await this.snapshotJobPublisher.publishGenerateWidgetSnapshot({
                widgetId: widget.id,
                dashboardId: widget.dashboardId,
                tenantId: widget.tenantId,
                userId: widget.ownerUserId,
                widgetConfigVersion: widget.version,
                widgetConfigHash: widget.configHash,
                snapshotDate: formatSnapshotDateForTimezone(new Date(), input.timezone || 'UTC'),
                triggerSource: 'config_updated',
                correlationId: input.correlationId || null,
                causationId: input.causationId || null
            });
        }
        return widget ? toResponse(widget) : null;
    }
    async archive(input) {
        return this.repository.archive(input);
    }
}
function toResponse(widget) {
    return {
        id: widget.id,
        dashboardId: widget.dashboardId,
        type: widget.type,
        title: widget.title,
        x: widget.x,
        y: widget.y,
        width: widget.width,
        height: widget.height,
        minWidth: widget.minWidth,
        minHeight: widget.minHeight,
        isVisible: widget.isVisible,
        sortOrder: widget.sortOrder,
        config: widget.config,
        includeInBriefingDefault: widget.includeInBriefingDefault,
        includeInBriefingOverride: widget.includeInBriefingOverride,
        includeInBriefing: widget.includeInBriefing,
        data: widget.data,
        createdAt: widget.createdAt.toISOString(),
        updatedAt: widget.updatedAt.toISOString()
    };
}
