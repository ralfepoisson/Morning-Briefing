import { createHash } from 'node:crypto';
import { logApplicationEvent } from '../admin/application-logger.js';
import { getWidgetDefinition } from '../widgets/widget-definitions.js';
import { stableStringify } from '../snapshots/snapshot-job-utils.js';
export class DashboardBriefingAggregationService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async buildInput(dashboardId, user, preferences) {
        const dashboard = await this.repository.findDashboardAggregationContext(dashboardId, user.userId);
        if (!dashboard) {
            return null;
        }
        const skippedWidgets = [];
        const sections = dashboard.widgets.reduce((items, widget) => {
            if (!isWidgetIncluded(widget.type, widget.includeInBriefingOverride, preferences.includeWidgetTypes)) {
                skippedWidgets.push({
                    widgetId: widget.id,
                    reason: 'not_included'
                });
                return items;
            }
            if (!widget.latestSnapshot || widget.latestSnapshot.status !== 'READY') {
                skippedWidgets.push({
                    widgetId: widget.id,
                    reason: 'missing_or_unready_snapshot'
                });
                return items;
            }
            const section = buildSection(widget, widget.latestSnapshot);
            if (!section) {
                skippedWidgets.push({
                    widgetId: widget.id,
                    reason: 'unsupported_or_empty_snapshot'
                });
                return items;
            }
            items.push(section);
            return items;
        }, []);
        const input = {
            tenantId: dashboard.tenantId,
            dashboardId: dashboard.id,
            dashboardName: dashboard.name,
            generatedAt: new Date().toISOString(),
            language: preferences.language,
            tone: preferences.tone,
            targetDurationSeconds: preferences.targetDurationSeconds,
            listener: {
                greetingName: normalizeOptionalString(user.phoneticName) || extractFirstName(user.displayName)
            },
            sections
        };
        logApplicationEvent({
            level: 'info',
            scope: 'dashboard-briefing',
            event: 'dashboard_briefing_aggregated',
            message: 'Dashboard briefing input aggregated.',
            context: {
                dashboardId: dashboard.id,
                ownerUserId: user.userId,
                includedSectionCount: sections.length,
                skippedWidgetCount: skippedWidgets.length,
                includedWidgetTypes: Array.from(new Set(sections.map(function mapSection(section) {
                    return section.widgetType;
                }))),
                skippedWidgets
            }
        });
        return {
            input,
            sourceSnapshotHash: createAggregationHash(dashboard.id, preferences, dashboard.widgets),
            includedWidgetTypes: Array.from(new Set(sections.map(function mapSection(section) {
                return section.widgetType;
            }))),
            skippedWidgets
        };
    }
}
function isWidgetIncluded(widgetType, includeInBriefingOverride, includeWidgetTypes) {
    if (typeof includeInBriefingOverride === 'boolean') {
        return includeInBriefingOverride;
    }
    if (includeWidgetTypes.length > 0) {
        return includeWidgetTypes.includes(widgetType);
    }
    const definition = getWidgetDefinition(widgetType);
    return !!(definition && definition.briefingDefaultIncluded);
}
function buildSection(widget, snapshot) {
    const content = asObject(snapshot.content);
    if (widget.type === 'weather') {
        const summary = {
            location: readString(content.location),
            temperature: readString(content.temperature),
            condition: readString(content.condition),
            highLow: readString(content.highLow),
            summary: readString(content.summary),
            details: readLabelValueList(content.details)
        };
        if (!summary.location && !summary.summary && !summary.condition) {
            return null;
        }
        return {
            widgetId: widget.id,
            widgetType: widget.type,
            title: widget.title,
            importance: 'high',
            content: summary
        };
    }
    if (widget.type === 'calendar') {
        const appointments = Array.isArray(content.appointments)
            ? content.appointments.map(function mapAppointment(item) {
                const record = asObject(item);
                return {
                    startTime: readString(record.time),
                    title: readString(record.title),
                    location: readString(record.location),
                    allDay: readBoolean(record.isAllDay)
                };
            }).filter(function filterAppointment(item) {
                return item.title;
            })
            : [];
        if (!appointments.length) {
            return null;
        }
        return {
            widgetId: widget.id,
            widgetType: widget.type,
            title: widget.title,
            importance: 'high',
            content: {
                dateLabel: readString(content.dateLabel, 'Today'),
                events: appointments.slice(0, 6)
            }
        };
    }
    if (widget.type === 'tasks') {
        const groups = Array.isArray(content.groups) ? content.groups.map(function mapGroup(group) {
            const record = asObject(group);
            return {
                label: readString(record.label),
                items: Array.isArray(record.items)
                    ? record.items.map(function mapItem(item) {
                        const task = asObject(item);
                        return {
                            title: readString(task.title),
                            meta: readString(task.meta)
                        };
                    }).filter(function filterTask(item) {
                        return item.title;
                    })
                    : []
            };
        }).filter(function filterGroup(group) {
            return group.label && group.items.length;
        }) : [];
        if (!groups.length) {
            return null;
        }
        return {
            widgetId: widget.id,
            widgetType: widget.type,
            title: widget.title,
            importance: 'high',
            content: {
                dueToday: findTaskGroup(groups, 'Due Today').slice(0, 5),
                noDueDate: findTaskGroup(groups, 'No Due Date').slice(0, 3),
                allGroups: groups.slice(0, 3)
            }
        };
    }
    if (widget.type === 'email') {
        const messages = Array.isArray(content.messages)
            ? content.messages.map(function mapMessage(item) {
                const record = asObject(item);
                return {
                    subject: readString(record.subject),
                    from: readString(record.from),
                    receivedAt: readString(record.receivedAt),
                    isUnread: readBoolean(record.isUnread)
                };
            }).filter(function filterMessage(item) {
                return item.subject || item.from;
            })
            : [];
        if (!messages.length) {
            return null;
        }
        return {
            widgetId: widget.id,
            widgetType: widget.type,
            title: widget.title,
            importance: 'medium',
            content: {
                unreadCount: messages.filter(function filterUnread(message) {
                    return message.isUnread;
                }).length,
                recentMessages: messages.slice(0, 5)
            }
        };
    }
    if (widget.type === 'news') {
        const categories = Array.isArray(content.categories) ? content.categories.map(function mapCategory(category) {
            const record = asObject(category);
            return {
                name: readString(record.name),
                bullets: Array.isArray(record.bullets)
                    ? record.bullets.map(function mapBullet(item) {
                        const bullet = asObject(item);
                        return {
                            headline: readString(bullet.headline),
                            summary: readString(bullet.summary),
                            sourceName: readString(bullet.sourceName),
                            url: readString(bullet.url)
                        };
                    }).filter(function filterBullet(item) {
                        return item.headline;
                    })
                    : []
            };
        }).filter(function filterCategory(category) {
            return category.name && category.bullets.length;
        }) : [];
        const headlines = categories.flatMap(function flattenCategory(category) {
            return category.bullets;
        }).slice(0, 5);
        if (!headlines.length) {
            return null;
        }
        return {
            widgetId: widget.id,
            widgetType: widget.type,
            title: widget.title,
            importance: 'medium',
            content: {
                headline: readString(content.headline),
                headlines,
                categories: categories.slice(0, 3)
            }
        };
    }
    return null;
}
function createAggregationHash(dashboardId, preferences, widgets) {
    return createHash('sha256').update(stableStringify({
        dashboardId,
        preferences: {
            targetDurationSeconds: preferences.targetDurationSeconds,
            tone: preferences.tone,
            language: preferences.language,
            voiceName: preferences.voiceName,
            includeWidgetTypes: preferences.includeWidgetTypes
        },
        widgets: widgets.map(function mapWidget(widget) {
            return {
                id: widget.id,
                type: widget.type,
                includeInBriefingOverride: widget.includeInBriefingOverride,
                snapshot: widget.latestSnapshot
                    ? {
                        id: widget.latestSnapshot.id,
                        status: widget.latestSnapshot.status,
                        contentHash: widget.latestSnapshot.contentHash,
                        generatedAt: widget.latestSnapshot.generatedAt.toISOString()
                    }
                    : null
            };
        })
    })).digest('hex');
}
function normalizeOptionalString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function extractFirstName(displayName) {
    const normalized = normalizeOptionalString(displayName);
    if (!normalized) {
        return null;
    }
    const parts = normalized.split(/\s+/).filter(Boolean);
    return parts.length ? parts[0] : null;
}
function readString(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function readBoolean(value) {
    return value === true;
}
function asObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return {};
}
function readLabelValueList(value) {
    return Array.isArray(value)
        ? value.map(function mapItem(item) {
            const record = asObject(item);
            return {
                label: readString(record.label),
                value: readString(record.value)
            };
        }).filter(function filterItem(item) {
            return item.label && item.value;
        })
        : [];
}
function findTaskGroup(groups, label) {
    const match = groups.find(function findGroup(group) {
        return group.label === label;
    });
    return match ? match.items : [];
}
