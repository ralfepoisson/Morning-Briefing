export class PrismaDashboardBriefingRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listDashboardsForScheduledGeneration() {
        try {
            const dashboards = await this.prisma.dashboard.findMany({
                where: {
                    archivedAt: null
                },
                orderBy: [
                    { createdAt: 'asc' }
                ],
                select: {
                    id: true,
                    tenantId: true,
                    isGenerating: true,
                    widgets: {
                        where: {
                            archivedAt: null,
                            isVisible: true
                        },
                        select: {
                            snapshots: {
                                orderBy: [
                                    { generatedAt: 'desc' },
                                    { id: 'desc' }
                                ],
                                take: 1,
                                select: {
                                    status: true
                                }
                            }
                        }
                    },
                    owner: {
                        select: {
                            id: true,
                            displayName: true,
                            phoneticName: true,
                            timezone: true,
                            locale: true,
                            email: true,
                            isAdmin: true
                        }
                    },
                    briefingPreferences: {
                        select: {
                            enabled: true
                        }
                    }
                }
            });
            return dashboards.map(function mapDashboard(dashboard) {
                return {
                    id: dashboard.id,
                    tenantId: dashboard.tenantId,
                    isGenerating: dashboard.isGenerating,
                    hasReadySnapshot: dashboard.widgets.some(function hasReadySnapshot(widget) {
                        return widget.snapshots[0]?.status === 'READY';
                    }),
                    owner: dashboard.owner,
                    briefingPreference: dashboard.briefingPreferences
                        ? {
                            enabled: dashboard.briefingPreferences.enabled
                        }
                        : null
                };
            });
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error) && !isMissingDashboardGeneratingSchemaError(error)) {
                throw error;
            }
            const dashboards = await this.prisma.dashboard.findMany({
                where: {
                    archivedAt: null
                },
                orderBy: [
                    { createdAt: 'asc' }
                ],
                select: {
                    id: true,
                    tenantId: true,
                    widgets: {
                        where: {
                            archivedAt: null,
                            isVisible: true
                        },
                        select: {
                            snapshots: {
                                orderBy: [
                                    { generatedAt: 'desc' },
                                    { id: 'desc' }
                                ],
                                take: 1,
                                select: {
                                    status: true
                                }
                            }
                        }
                    },
                    owner: {
                        select: {
                            id: true,
                            displayName: true,
                            phoneticName: true,
                            timezone: true,
                            locale: true,
                            email: true,
                            isAdmin: true
                        }
                    }
                }
            });
            return dashboards.map(function mapLegacyDashboard(dashboard) {
                return {
                    id: dashboard.id,
                    tenantId: dashboard.tenantId,
                    isGenerating: false,
                    hasReadySnapshot: dashboard.widgets.some(function hasReadySnapshot(widget) {
                        return widget.snapshots[0]?.status === 'READY';
                    }),
                    owner: dashboard.owner,
                    briefingPreference: null
                };
            });
        }
    }
    async setDashboardGenerating(dashboardId, ownerUserId, isGenerating) {
        const dashboard = await this.prisma.dashboard.findFirst({
            where: {
                id: dashboardId,
                ownerUserId,
                archivedAt: null
            },
            select: {
                id: true
            }
        });
        if (!dashboard) {
            return;
        }
        await this.prisma.dashboard.update({
            where: {
                id: dashboard.id
            },
            data: {
                isGenerating
            }
        });
    }
    async findDashboardAggregationContext(dashboardId, ownerUserId) {
        try {
            const dashboard = await this.prisma.dashboard.findFirst({
                where: {
                    id: dashboardId,
                    ownerUserId,
                    archivedAt: null
                },
                select: {
                    id: true,
                    tenantId: true,
                    ownerUserId: true,
                    name: true
                }
            });
            if (!dashboard) {
                return null;
            }
            const widgets = await this.prisma.dashboardWidget.findMany({
                where: {
                    dashboardId: dashboard.id,
                    archivedAt: null,
                    isVisible: true
                },
                orderBy: [
                    { sortOrder: 'asc' },
                    { createdAt: 'asc' }
                ],
                select: {
                    id: true,
                    widgetType: true,
                    title: true,
                    includeInBriefingOverride: true,
                    snapshots: {
                        orderBy: [
                            { generatedAt: 'desc' },
                            { id: 'desc' }
                        ],
                        take: 1,
                        select: {
                            id: true,
                            widgetType: true,
                            title: true,
                            status: true,
                            contentJson: true,
                            contentHash: true,
                            errorMessage: true,
                            generatedAt: true
                        }
                    }
                }
            });
            return {
                id: dashboard.id,
                tenantId: dashboard.tenantId,
                ownerUserId: dashboard.ownerUserId,
                name: dashboard.name,
                widgets: widgets.map(function mapWidget(widget) {
                    return {
                        id: widget.id,
                        type: widget.widgetType,
                        title: widget.title,
                        includeInBriefingOverride: typeof widget.includeInBriefingOverride === 'boolean'
                            ? widget.includeInBriefingOverride
                            : null,
                        latestSnapshot: widget.snapshots.length ? mapWidgetSnapshot(widget.snapshots[0]) : null
                    };
                })
            };
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            const dashboard = await this.prisma.dashboard.findFirst({
                where: {
                    id: dashboardId,
                    ownerUserId,
                    archivedAt: null
                },
                select: {
                    id: true,
                    tenantId: true,
                    ownerUserId: true,
                    name: true
                }
            });
            if (!dashboard) {
                return null;
            }
            const widgets = await this.prisma.dashboardWidget.findMany({
                where: {
                    dashboardId: dashboard.id,
                    archivedAt: null,
                    isVisible: true
                },
                orderBy: [
                    { sortOrder: 'asc' },
                    { createdAt: 'asc' }
                ],
                select: {
                    id: true,
                    widgetType: true,
                    title: true,
                    snapshots: {
                        orderBy: [
                            { generatedAt: 'desc' },
                            { id: 'desc' }
                        ],
                        take: 1,
                        select: {
                            id: true,
                            widgetType: true,
                            title: true,
                            status: true,
                            contentJson: true,
                            contentHash: true,
                            errorMessage: true,
                            generatedAt: true
                        }
                    }
                }
            });
            return {
                id: dashboard.id,
                tenantId: dashboard.tenantId,
                ownerUserId: dashboard.ownerUserId,
                name: dashboard.name,
                widgets: widgets.map(function mapLegacyWidget(widget) {
                    return {
                        id: widget.id,
                        type: widget.widgetType,
                        title: widget.title,
                        includeInBriefingOverride: null,
                        latestSnapshot: widget.snapshots.length ? mapWidgetSnapshot(widget.snapshots[0]) : null
                    };
                })
            };
        }
    }
    async findPreference(dashboardId, ownerUserId) {
        try {
            const preference = await this.prisma.dashboardBriefingPreference.findFirst({
                where: {
                    dashboardId,
                    dashboard: {
                        ownerUserId,
                        archivedAt: null
                    }
                }
            });
            return preference ? mapPreference(preference) : null;
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return null;
        }
    }
    async upsertPreference(input) {
        const dashboard = await this.prisma.dashboard.findFirst({
            where: {
                id: input.dashboardId,
                ownerUserId: input.ownerUserId,
                archivedAt: null
            }
        });
        if (!dashboard) {
            return null;
        }
        try {
            const preference = await this.prisma.dashboardBriefingPreference.upsert({
                where: {
                    dashboardId: dashboard.id
                },
                update: {
                    enabled: input.enabled,
                    autoGenerate: input.autoGenerate,
                    targetDurationSeconds: input.targetDurationSeconds,
                    tone: input.tone,
                    language: input.language,
                    voiceName: input.voiceName,
                    includeWidgetTypesJson: input.includeWidgetTypes
                },
                create: {
                    dashboardId: dashboard.id,
                    enabled: input.enabled,
                    autoGenerate: input.autoGenerate,
                    targetDurationSeconds: input.targetDurationSeconds,
                    tone: input.tone,
                    language: input.language,
                    voiceName: input.voiceName,
                    includeWidgetTypesJson: input.includeWidgetTypes
                }
            });
            return mapPreference(preference);
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return null;
        }
    }
    async findLatestBriefing(dashboardId, ownerUserId) {
        try {
            const briefing = await this.prisma.dashboardBriefing.findFirst({
                where: {
                    dashboardId,
                    dashboard: {
                        ownerUserId,
                        archivedAt: null
                    }
                },
                include: {
                    audio: {
                        orderBy: [
                            { createdAt: 'desc' },
                            { id: 'desc' }
                        ],
                        take: 1
                    }
                },
                orderBy: [
                    { createdAt: 'desc' },
                    { id: 'desc' }
                ]
            });
            return briefing ? mapBriefing(briefing) : null;
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return null;
        }
    }
    async findReusableReadyBriefing(dashboardId, ownerUserId, sourceSnapshotHash) {
        try {
            const briefing = await this.prisma.dashboardBriefing.findFirst({
                where: {
                    dashboardId,
                    sourceSnapshotHash,
                    status: 'READY',
                    dashboard: {
                        ownerUserId,
                        archivedAt: null
                    }
                },
                include: {
                    audio: {
                        orderBy: [
                            { createdAt: 'desc' },
                            { id: 'desc' }
                        ],
                        take: 1
                    }
                },
                orderBy: [
                    { createdAt: 'desc' },
                    { id: 'desc' }
                ]
            });
            return briefing ? mapBriefing(briefing) : null;
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return null;
        }
    }
    async createBriefing(input) {
        const dashboard = await this.prisma.dashboard.findFirst({
            where: {
                id: input.dashboardId,
                ownerUserId: input.ownerUserId,
                archivedAt: null
            }
        });
        if (!dashboard) {
            return null;
        }
        try {
            const briefing = await this.prisma.dashboardBriefing.create({
                data: {
                    dashboardId: dashboard.id,
                    status: input.status,
                    sourceSnapshotHash: input.sourceSnapshotHash,
                    modelName: input.modelName,
                    promptVersion: input.promptVersion
                },
                include: {
                    audio: {
                        orderBy: [
                            { createdAt: 'desc' },
                            { id: 'desc' }
                        ],
                        take: 1
                    }
                }
            });
            return mapBriefing(briefing);
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return null;
        }
    }
    async updateBriefing(input) {
        let existing;
        try {
            existing = await this.prisma.dashboardBriefing.findFirst({
                where: {
                    id: input.briefingId,
                    dashboard: {
                        ownerUserId: input.ownerUserId,
                        archivedAt: null
                    }
                }
            });
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return null;
        }
        if (!existing) {
            return null;
        }
        const nextScriptJson = input.scriptJson
            ? {
                ...input.scriptJson,
                metadata: {
                    ...readMetadata(input.scriptJson),
                    sourceWidgetTypes: input.sourceWidgetTypes || readMetadata(input.scriptJson).sourceWidgetTypes || []
                }
            }
            : undefined;
        try {
            const briefing = await this.prisma.dashboardBriefing.update({
                where: {
                    id: existing.id
                },
                data: {
                    status: input.status,
                    generatedAt: input.generatedAt,
                    modelName: input.modelName,
                    promptVersion: input.promptVersion,
                    scriptText: input.scriptText,
                    scriptJson: nextScriptJson,
                    estimatedDurationSeconds: input.estimatedDurationSeconds,
                    errorMessage: input.errorMessage
                },
                include: {
                    audio: {
                        orderBy: [
                            { createdAt: 'desc' },
                            { id: 'desc' }
                        ],
                        take: 1
                    }
                }
            });
            return mapBriefing(briefing);
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return null;
        }
    }
    async createAudio(input) {
        let briefing;
        try {
            briefing = await this.prisma.dashboardBriefing.findFirst({
                where: {
                    id: input.briefingId,
                    dashboard: {
                        ownerUserId: input.ownerUserId,
                        archivedAt: null
                    }
                }
            });
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return null;
        }
        if (!briefing) {
            return null;
        }
        try {
            const audio = await this.prisma.dashboardBriefingAudio.create({
                data: {
                    dashboardBriefingId: briefing.id,
                    provider: input.provider,
                    voiceName: input.voiceName,
                    storageKey: input.storageKey,
                    mimeType: input.mimeType,
                    durationSeconds: input.durationSeconds,
                    generatedAt: input.generatedAt
                }
            });
            return mapAudio(audio);
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return null;
        }
    }
    async findAudioById(audioId, ownerUserId) {
        try {
            const audio = await this.prisma.dashboardBriefingAudio.findFirst({
                where: {
                    id: audioId,
                    briefing: {
                        dashboard: {
                            ownerUserId,
                            archivedAt: null
                        }
                    }
                }
            });
            return audio ? mapAudio(audio) : null;
        }
        catch (error) {
            if (!isMissingBriefingSchemaError(error)) {
                throw error;
            }
            return null;
        }
    }
}
function mapPreference(preference) {
    return {
        id: preference.id,
        dashboardId: preference.dashboardId,
        enabled: preference.enabled,
        autoGenerate: preference.autoGenerate,
        targetDurationSeconds: preference.targetDurationSeconds,
        tone: preference.tone,
        language: preference.language,
        voiceName: preference.voiceName,
        includeWidgetTypes: readStringArray(preference.includeWidgetTypesJson),
        createdAt: preference.createdAt,
        updatedAt: preference.updatedAt
    };
}
function mapBriefing(briefing) {
    const scriptJson = asObject(briefing.scriptJson);
    const metadata = readMetadata(scriptJson);
    return {
        id: briefing.id,
        dashboardId: briefing.dashboardId,
        status: briefing.status,
        sourceSnapshotHash: briefing.sourceSnapshotHash,
        generatedAt: briefing.generatedAt,
        modelName: briefing.modelName,
        promptVersion: briefing.promptVersion,
        scriptText: briefing.scriptText,
        scriptJson,
        estimatedDurationSeconds: briefing.estimatedDurationSeconds,
        errorMessage: briefing.errorMessage,
        sourceWidgetTypes: Array.isArray(metadata.sourceWidgetTypes) ? metadata.sourceWidgetTypes : [],
        createdAt: briefing.createdAt,
        updatedAt: briefing.updatedAt,
        audio: briefing.audio && briefing.audio.length ? mapAudio(briefing.audio[0]) : null
    };
}
function mapAudio(audio) {
    return {
        id: audio.id,
        dashboardBriefingId: audio.dashboardBriefingId,
        provider: audio.provider,
        voiceName: audio.voiceName,
        storageKey: audio.storageKey,
        mimeType: audio.mimeType,
        durationSeconds: audio.durationSeconds,
        generatedAt: audio.generatedAt,
        createdAt: audio.createdAt,
        updatedAt: audio.updatedAt
    };
}
function mapWidgetSnapshot(snapshot) {
    return {
        id: snapshot.id,
        status: snapshot.status,
        content: asObject(snapshot.contentJson),
        contentHash: snapshot.contentHash || '',
        generatedAt: snapshot.generatedAt,
        errorMessage: snapshot.errorMessage
    };
}
function readStringArray(value) {
    return Array.isArray(value)
        ? value.filter(function filterValue(item) {
            return typeof item === 'string' && item.trim().length > 0;
        }).map(function trimValue(item) {
            return item.trim();
        })
        : [];
}
function asObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return {};
}
function readMetadata(value) {
    const metadata = asObject(value.metadata);
    const sourceWidgetTypes = readStringArray(metadata.sourceWidgetTypes);
    return sourceWidgetTypes.length ? { sourceWidgetTypes } : {};
}
function isMissingBriefingSchemaError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const candidate = error;
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    return candidate.code === 'P2021'
        || candidate.code === 'P2022'
        || message.includes('dashboard_briefing_')
        || message.includes('include_in_briefing_override');
}
function isMissingDashboardGeneratingSchemaError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.message.includes('dashboards.is_generating');
}
