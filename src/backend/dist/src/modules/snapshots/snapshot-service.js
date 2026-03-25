import { logApplicationEvent } from '../admin/application-logger.js';
import { XkcdClientImpl } from './xkcd-client.js';
export class SnapshotService {
    repository;
    rssFeedRepository;
    weatherClient;
    todoistTaskClient;
    googleCalendarClient;
    googleCalendarOAuthClient;
    rssFeedClient;
    openAiNewsSummarizer;
    xkcdClient;
    constructor(repository, rssFeedRepository, weatherClient, todoistTaskClient, googleCalendarClient, googleCalendarOAuthClient, rssFeedClient, openAiNewsSummarizer, xkcdClient = new XkcdClientImpl()) {
        this.repository = repository;
        this.rssFeedRepository = rssFeedRepository;
        this.weatherClient = weatherClient;
        this.todoistTaskClient = todoistTaskClient;
        this.googleCalendarClient = googleCalendarClient;
        this.googleCalendarOAuthClient = googleCalendarOAuthClient;
        this.rssFeedClient = rssFeedClient;
        this.openAiNewsSummarizer = openAiNewsSummarizer;
        this.xkcdClient = xkcdClient;
    }
    async generateForWidget(message) {
        const widget = await this.repository.findWidgetForSnapshotGeneration(message.widgetId);
        if (!widget) {
            return {
                status: 'skipped',
                reason: 'widget_not_found'
            };
        }
        if (!widget.isVisible) {
            return {
                status: 'skipped',
                reason: 'widget_not_visible'
            };
        }
        if (widget.refreshMode === 'LIVE') {
            return {
                status: 'skipped',
                reason: 'widget_not_snapshot_based'
            };
        }
        if (widget.version !== message.widgetConfigVersion || widget.configHash !== message.widgetConfigHash) {
            return {
                status: 'skipped',
                reason: 'stale_message'
            };
        }
        const generatedAt = new Date();
        const widgetSnapshot = await this.buildWidgetSnapshot(widget, generatedAt);
        this.logWidgetSnapshotFailureIfNeeded(widget, widgetSnapshot, {
            snapshotDate: message.snapshotDate,
            triggerSource: message.triggerSource,
            source: 'queue'
        });
        await this.repository.upsertWidgetSnapshot({
            widget,
            snapshotDate: message.snapshotDate,
            widgetSnapshot
        });
        this.logSnapshotProgress('widget_snapshot_persisted', 'Widget snapshot stored.', {
            widgetId: widget.id,
            widgetType: widget.type,
            widgetTitle: widget.title,
            dashboardId: widget.dashboardId,
            tenantId: widget.tenantId,
            snapshotDate: message.snapshotDate,
            triggerSource: message.triggerSource,
            status: widgetSnapshot.status
        });
        return {
            status: 'generated'
        };
    }
    async getPersistedLatestForDashboard(dashboardId, user) {
        const snapshot = await this.repository.findLatestDashboardSnapshot(dashboardId, user.userId);
        return snapshot ? toResponse(snapshot) : null;
    }
    async getLatestForDashboard(dashboardId, user) {
        const dashboard = await this.repository.findDashboardWithWidgets(dashboardId, user.userId);
        if (!dashboard) {
            return null;
        }
        const generatedAt = new Date();
        const widgetSnapshots = [];
        for (const widget of dashboard.widgets) {
            widgetSnapshots.push(await this.buildWidgetSnapshot(widget, generatedAt));
        }
        widgetSnapshots.forEach((widgetSnapshot) => {
            const widget = dashboard.widgets.find(function findWidget(candidate) {
                return candidate.id === widgetSnapshot.widgetId;
            });
            if (widget) {
                this.logWidgetSnapshotFailureIfNeeded(widget, widgetSnapshot, {
                    source: 'dashboard_refresh'
                });
            }
        });
        const generationStatus = widgetSnapshots.every(function isReady(widgetSnapshot) {
            return widgetSnapshot.status === 'READY';
        }) ? 'READY' : 'FAILED';
        const snapshot = await this.repository.upsertDashboardSnapshot({
            tenantId: dashboard.tenantId,
            userId: user.userId,
            dashboardId: dashboard.id,
            snapshotDate: startOfDay(generatedAt),
            generationStatus: generationStatus,
            summary: {
                headline: buildSummary(widgetSnapshots)
            },
            widgets: widgetSnapshots
        });
        this.logSnapshotProgress('dashboard_snapshot_persisted', 'Dashboard snapshot stored.', {
            dashboardId: dashboard.id,
            tenantId: dashboard.tenantId,
            userId: user.userId,
            generationStatus,
            widgetCount: widgetSnapshots.length
        });
        return toResponse(snapshot);
    }
    logWidgetSnapshotFailureIfNeeded(widget, widgetSnapshot, extraContext) {
        if (widgetSnapshot.status !== 'FAILED') {
            return;
        }
        const connector = widget.connections[0];
        logApplicationEvent({
            level: classifySnapshotFailureLevel(widgetSnapshot.errorMessage),
            scope: 'snapshot-service',
            event: 'widget_snapshot_failed',
            message: widgetSnapshot.errorMessage || widget.type + ' widget snapshot generation failed.',
            context: {
                widgetId: widget.id,
                widgetType: widget.type,
                widgetTitle: widget.title,
                dashboardId: widget.dashboardId,
                tenantId: widget.tenantId,
                provider: typeof widget.config.provider === 'string' ? widget.config.provider : null,
                connectionId: connector ? connector.connector.id : null,
                connectionName: connector ? connector.connector.name : null,
                errorMessage: widgetSnapshot.errorMessage,
                ...extraContext
            }
        });
    }
    logSnapshotProgress(event, message, context) {
        logApplicationEvent({
            level: 'info',
            scope: 'snapshot-service',
            event,
            message,
            context
        });
    }
    async buildWidgetSnapshot(widget, generatedAt) {
        if (widget.type === 'news') {
            return this.buildNewsWidgetSnapshot(widget, generatedAt);
        }
        if (widget.type === 'xkcd') {
            return this.buildXkcdWidgetSnapshot(widget, generatedAt);
        }
        if (widget.type === 'calendar') {
            return this.buildCalendarWidgetSnapshot(widget, generatedAt);
        }
        if (widget.type === 'tasks') {
            return this.buildTaskWidgetSnapshot(widget, generatedAt);
        }
        if (widget.type !== 'weather') {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'READY',
                content: widget.data,
                errorMessage: null,
                generatedAt: generatedAt
            };
        }
        const location = getWeatherLocation(widget.config);
        if (!location) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    location: 'Select a city',
                    temperature: '--',
                    condition: 'Configuration required',
                    highLow: '--',
                    summary: 'Choose a city in edit mode to generate a live weather snapshot.',
                    details: []
                },
                errorMessage: 'Weather widget is missing a configured city.',
                generatedAt: generatedAt
            };
        }
        try {
            const content = await this.weatherClient.getSnapshot({
                latitude: location.latitude,
                longitude: location.longitude,
                timezone: location.timezone || 'auto',
                locationLabel: location.displayName
            });
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'READY',
                content: content,
                errorMessage: null,
                generatedAt: generatedAt
            };
        }
        catch (error) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    location: location.displayName,
                    temperature: '--',
                    condition: 'Unavailable',
                    highLow: '--',
                    summary: 'The live weather provider could not be reached. Please try again.',
                    details: []
                },
                errorMessage: error instanceof Error ? error.message : 'Weather snapshot generation failed.',
                generatedAt: generatedAt
            };
        }
    }
    async buildXkcdWidgetSnapshot(widget, generatedAt) {
        try {
            const comic = await this.xkcdClient.getLatestComic();
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'READY',
                content: {
                    comicId: comic.id,
                    title: comic.title,
                    altText: comic.altText,
                    imageUrl: comic.imageUrl,
                    permalink: comic.permalink,
                    publishedAt: comic.publishedAt,
                    emptyMessage: ''
                },
                errorMessage: null,
                generatedAt
            };
        }
        catch (error) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    comicId: 0,
                    title: 'Latest xkcd unavailable',
                    altText: 'The latest xkcd comic could not be loaded right now.',
                    imageUrl: '',
                    permalink: 'https://xkcd.com/',
                    publishedAt: '',
                    emptyMessage: 'The latest xkcd comic could not be loaded right now. Please try again.'
                },
                errorMessage: error instanceof Error ? error.message : 'xkcd snapshot generation failed.',
                generatedAt
            };
        }
    }
    async buildNewsWidgetSnapshot(widget, generatedAt) {
        const snapshotDate = formatDateKey(generatedAt);
        const categories = await this.rssFeedRepository.listCategories(widget.tenantId);
        const configuredCategories = categories.filter(function hasFeeds(category) {
            return category.feeds.length > 0;
        });
        this.logSnapshotProgress('news_rss_categories_loaded', 'Loaded RSS feed categories for news snapshot.', {
            widgetId: widget.id,
            widgetType: widget.type,
            widgetTitle: widget.title,
            dashboardId: widget.dashboardId,
            tenantId: widget.tenantId,
            categoryCount: categories.length,
            configuredCategoryCount: configuredCategories.length
        });
        if (!configuredCategories.length) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    headline: 'News source configuration required.',
                    markdown: '# News source configuration required.\n\nAdd RSS feeds on the RSS Feeds page to generate a news snapshot.',
                    categories: [],
                    emptyMessage: 'Add RSS feeds on the RSS Feeds page to start generating news summaries.'
                },
                errorMessage: 'News widget cannot generate a snapshot without configured RSS feeds.',
                generatedAt
            };
        }
        const connector = widget.connections.find(function findConnector(item) {
            return item.usageRole === 'llm';
        });
        if (!connector) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    headline: 'LLM configuration required.',
                    markdown: '# LLM configuration required.\n\nChoose an OpenAI connection in the News widget settings to generate a news snapshot.',
                    categories: [],
                    emptyMessage: 'Choose an OpenAI connection in edit mode to configure this widget.',
                    sourceErrors: []
                },
                errorMessage: 'News widget is missing a configured LLM connection.',
                generatedAt
            };
        }
        if (connector.connector.type !== 'openai') {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    headline: 'Unsupported news summarization provider.',
                    markdown: '# Unsupported news summarization provider.\n\nThe selected News widget connection is not supported yet.',
                    categories: [],
                    emptyMessage: 'The selected LLM provider is not supported yet.',
                    sourceErrors: []
                },
                errorMessage: 'News widget is configured with an unsupported LLM provider.',
                generatedAt
            };
        }
        const apiKey = getConnectorApiKey(connector.connector.config);
        const model = getOpenAiModel(connector.connector.config);
        const baseUrl = getOpenAiBaseUrl(connector.connector.config);
        if (!apiKey) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    headline: 'OpenAI API key required.',
                    markdown: '# OpenAI API key required.\n\nThe selected OpenAI connection is missing its API key.',
                    categories: [],
                    emptyMessage: 'The selected OpenAI connection is missing its API key.',
                    sourceErrors: []
                },
                errorMessage: 'OpenAI connection is missing an API key.',
                generatedAt
            };
        }
        const sourceErrors = [];
        let preparedCategories = [];
        const existingSelections = await this.repository.listNewsArticleSelections(widget.id, snapshotDate);
        if (existingSelections.length) {
            preparedCategories = restorePreparedNewsCategories(existingSelections);
            this.logSnapshotProgress('news_article_pool_reused', 'Reused persisted news article pool for snapshot date.', {
                widgetId: widget.id,
                widgetType: widget.type,
                widgetTitle: widget.title,
                dashboardId: widget.dashboardId,
                tenantId: widget.tenantId,
                snapshotDate,
                categoryCount: preparedCategories.length,
                articleCount: existingSelections.length
            });
        }
        else {
            const priorArticleKeys = new Set(await this.repository.listPriorNewsArticleKeys(widget.id, snapshotDate));
            this.logSnapshotProgress('news_prior_article_keys_loaded', 'Loaded prior considered news article keys.', {
                widgetId: widget.id,
                widgetType: widget.type,
                widgetTitle: widget.title,
                dashboardId: widget.dashboardId,
                tenantId: widget.tenantId,
                snapshotDate,
                priorArticleKeyCount: priorArticleKeys.size
            });
            for (const category of configuredCategories) {
                const categoryArticles = [];
                for (const feed of category.feeds) {
                    try {
                        const result = await this.rssFeedClient.fetchFeed(feed.url);
                        this.logSnapshotProgress('news_rss_feed_loaded', 'Loaded RSS feed items for news snapshot.', {
                            widgetId: widget.id,
                            widgetType: widget.type,
                            widgetTitle: widget.title,
                            dashboardId: widget.dashboardId,
                            tenantId: widget.tenantId,
                            categoryName: category.name,
                            feedName: feed.name,
                            feedUrl: feed.url,
                            itemCount: result.items.length
                        });
                        result.items.slice(0, 4).forEach(function pushItem(item) {
                            const article = {
                                title: item.title,
                                url: item.url,
                                summary: item.summary,
                                publishedAt: item.publishedAt,
                                sourceName: item.sourceName || feed.name
                            };
                            if (priorArticleKeys.has(buildNewsArticleKey(article))) {
                                return;
                            }
                            categoryArticles.push(article);
                        });
                    }
                    catch (error) {
                        const errorMessage = feed.name + ': ' + (error instanceof Error ? error.message : 'Feed request failed.');
                        sourceErrors.push(errorMessage);
                        this.logSnapshotProgress('news_rss_feed_failed', 'RSS feed could not be loaded for news snapshot.', {
                            widgetId: widget.id,
                            widgetType: widget.type,
                            widgetTitle: widget.title,
                            dashboardId: widget.dashboardId,
                            tenantId: widget.tenantId,
                            categoryName: category.name,
                            feedName: feed.name,
                            feedUrl: feed.url,
                            errorMessage
                        });
                    }
                }
                const deduplicatedArticles = dedupeArticlesByKey(categoryArticles)
                    .sort(compareArticlesByDateDesc)
                    .slice(0, 10);
                if (deduplicatedArticles.length) {
                    preparedCategories.push({
                        name: category.name,
                        description: category.description,
                        articles: deduplicatedArticles
                    });
                }
            }
            if (preparedCategories.length) {
                const selections = flattenPreparedNewsCategories(preparedCategories);
                await this.repository.replaceNewsArticleSelections(widget, snapshotDate, selections);
                this.logSnapshotProgress('news_article_pool_persisted', 'Persisted day-scoped news article pool.', {
                    widgetId: widget.id,
                    widgetType: widget.type,
                    widgetTitle: widget.title,
                    dashboardId: widget.dashboardId,
                    tenantId: widget.tenantId,
                    snapshotDate,
                    categoryCount: preparedCategories.length,
                    articleCount: selections.length
                });
            }
        }
        if (!preparedCategories.length) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    headline: 'No RSS articles were available.',
                    markdown: '# No RSS articles were available.\n\nThe configured feeds could not be read or did not return any recent entries.',
                    categories: [],
                    emptyMessage: 'The configured feeds could not be read or did not return any entries.',
                    sourceErrors
                },
                errorMessage: sourceErrors[0] || 'News widget could not load any RSS articles.',
                generatedAt
            };
        }
        try {
            this.logSnapshotProgress('news_prompt_prepared', 'Prepared news summarization context.', {
                widgetId: widget.id,
                widgetType: widget.type,
                widgetTitle: widget.title,
                dashboardId: widget.dashboardId,
                tenantId: widget.tenantId,
                provider: connector.connector.type,
                connectionId: connector.connector.id,
                connectionName: connector.connector.name,
                model,
                baseUrl,
                categoryCount: preparedCategories.length,
                articleCount: preparedCategories.reduce(function countArticles(total, category) {
                    return total + category.articles.length;
                }, 0),
                sourceErrorCount: sourceErrors.length
            });
            const summary = await this.openAiNewsSummarizer.summarize({
                apiKey,
                model,
                baseUrl,
                snapshotDate,
                categories: preparedCategories
            });
            this.logSnapshotProgress('news_summary_completed', 'News summary generated successfully.', {
                widgetId: widget.id,
                widgetType: widget.type,
                widgetTitle: widget.title,
                dashboardId: widget.dashboardId,
                tenantId: widget.tenantId,
                provider: connector.connector.type,
                connectionId: connector.connector.id,
                connectionName: connector.connector.name,
                model,
                baseUrl,
                summaryCategoryCount: summary.categories.length,
                summaryBulletCount: summary.categories.reduce(function countBullets(total, category) {
                    return total + category.bullets.length;
                }, 0)
            });
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'READY',
                content: {
                    headline: summary.headline,
                    markdown: summary.markdown,
                    categories: summary.categories,
                    emptyMessage: '',
                    sourceErrors
                },
                errorMessage: null,
                generatedAt
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'News snapshot generation failed.';
            this.logSnapshotProgress('news_summary_failed', 'News summary generation failed.', {
                widgetId: widget.id,
                widgetType: widget.type,
                widgetTitle: widget.title,
                dashboardId: widget.dashboardId,
                tenantId: widget.tenantId,
                provider: connector.connector.type,
                connectionId: connector.connector.id,
                connectionName: connector.connector.name,
                model,
                baseUrl,
                errorMessage
            });
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    headline: 'News summarization failed.',
                    markdown: '# News summarization failed.\n\nThe RSS feeds were loaded, but OpenAI could not produce a summary.',
                    categories: [],
                    emptyMessage: 'OpenAI could not summarize the configured feeds.',
                    sourceErrors
                },
                errorMessage,
                generatedAt
            };
        }
    }
    async buildTaskWidgetSnapshot(widget, generatedAt) {
        const connector = widget.connections.find(function findConnector(item) {
            return item.usageRole === 'tasks';
        });
        if (!connector) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    provider: 'todoist',
                    connectionLabel: 'Not connected',
                    groups: [],
                    emptyMessage: 'Choose a Todoist connection in edit mode to configure this widget.'
                },
                errorMessage: 'Task list widget is missing a configured connection.',
                generatedAt: generatedAt
            };
        }
        if (connector.connector.type !== 'todoist') {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    provider: connector.connector.type,
                    connectionLabel: connector.connector.name,
                    groups: [],
                    emptyMessage: 'The selected task provider is not supported yet.'
                },
                errorMessage: 'Task list widget is configured with an unsupported provider.',
                generatedAt: generatedAt
            };
        }
        const apiKey = getConnectorApiKey(connector.connector.config);
        if (!apiKey) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    provider: 'todoist',
                    connectionLabel: connector.connector.name,
                    groups: [],
                    emptyMessage: 'The selected Todoist connection is missing its API key.'
                },
                errorMessage: 'Todoist connection is missing an API key.',
                generatedAt: generatedAt
            };
        }
        try {
            const tasks = await this.todoistTaskClient.listTasks(apiKey);
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'READY',
                content: buildTaskSnapshotContent(tasks, generatedAt, connector.connector.name),
                errorMessage: null,
                generatedAt: generatedAt
            };
        }
        catch (error) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    provider: 'todoist',
                    connectionLabel: connector.connector.name,
                    groups: [],
                    emptyMessage: 'Todoist could not be reached. Please check the API key and try again.'
                },
                errorMessage: error instanceof Error ? error.message : 'Todoist snapshot generation failed.',
                generatedAt: generatedAt
            };
        }
    }
    async buildCalendarWidgetSnapshot(widget, generatedAt) {
        const connector = widget.connections.find(function findConnector(item) {
            return item.usageRole === 'calendar';
        });
        if (!connector) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    provider: 'google-calendar',
                    connectionLabel: 'Not connected',
                    dateLabel: 'Today',
                    appointments: [],
                    emptyMessage: 'Choose a Google Calendar connection in edit mode to configure this widget.'
                },
                errorMessage: 'Calendar widget is missing a configured connection.',
                generatedAt: generatedAt
            };
        }
        if (connector.connector.type !== 'google-calendar') {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    provider: connector.connector.type,
                    connectionLabel: connector.connector.name,
                    dateLabel: 'Today',
                    appointments: [],
                    emptyMessage: 'The selected calendar provider is not supported yet.'
                },
                errorMessage: 'Calendar widget is configured with an unsupported provider.',
                generatedAt: generatedAt
            };
        }
        const accessToken = getGoogleCalendarAccessToken(connector.connector.config);
        const refreshToken = getGoogleCalendarRefreshToken(connector.connector.config);
        const calendarId = getGoogleCalendarId(connector.connector.config);
        if (connector.connector.authType !== 'OAUTH') {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    provider: 'google-calendar',
                    connectionLabel: connector.connector.name,
                    dateLabel: 'Today',
                    appointments: [],
                    emptyMessage: 'This Google Calendar connection needs OAuth access before it can load private events.'
                },
                errorMessage: 'Google Calendar connection is using an unsupported authentication mode.',
                generatedAt: generatedAt
            };
        }
        if (!refreshToken) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    provider: 'google-calendar',
                    connectionLabel: connector.connector.name,
                    dateLabel: 'Today',
                    appointments: [],
                    emptyMessage: 'The selected Google Calendar connection is missing its refresh token.'
                },
                errorMessage: 'Google Calendar connection is missing a refresh token.',
                generatedAt: generatedAt
            };
        }
        if (!calendarId) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    provider: 'google-calendar',
                    connectionLabel: connector.connector.name,
                    dateLabel: 'Today',
                    appointments: [],
                    emptyMessage: 'The selected Google Calendar connection is missing its calendar id.'
                },
                errorMessage: 'Google Calendar connection is missing a calendar id.',
                generatedAt: generatedAt
            };
        }
        try {
            const token = accessToken && !isTokenExpired(connector.connector.config)
                ? {
                    accessToken
                }
                : await this.googleCalendarOAuthClient.refreshAccessToken(refreshToken);
            const events = await this.googleCalendarClient.listEvents(token.accessToken, calendarId, generatedAt);
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'READY',
                content: buildCalendarSnapshotContent(events, connector.connector.name),
                errorMessage: null,
                generatedAt: generatedAt
            };
        }
        catch (error) {
            return {
                widgetId: widget.id,
                widgetType: widget.type,
                title: widget.title,
                status: 'FAILED',
                content: {
                    provider: 'google-calendar',
                    connectionLabel: connector.connector.name,
                    dateLabel: 'Today',
                    appointments: [],
                    emptyMessage: 'Google Calendar could not be reached. Please check the connection and try again.'
                },
                errorMessage: error instanceof Error ? error.message : 'Google Calendar snapshot generation failed.',
                generatedAt: generatedAt
            };
        }
    }
}
function getWeatherLocation(config) {
    if (!config.location || typeof config.location !== 'object') {
        return null;
    }
    const location = config.location;
    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        return null;
    }
    return {
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: typeof location.timezone === 'string' && location.timezone.trim() ? location.timezone : 'auto',
        displayName: getLocationLabel(location)
    };
}
function getLocationLabel(location) {
    if (typeof location.displayName === 'string' && location.displayName.trim()) {
        return location.displayName;
    }
    if (typeof location.name === 'string' && location.name.trim()) {
        if (typeof location.countryCode === 'string' && location.countryCode.trim()) {
            return `${location.name}, ${location.countryCode}`;
        }
        return location.name;
    }
    return 'Configured location';
}
function startOfDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function buildSummary(widgets) {
    const newsWidget = widgets.find(function findNewsWidget(widget) {
        return widget.widgetType === 'news' && widget.status === 'READY';
    });
    if (newsWidget && typeof newsWidget.content.headline === 'string' && newsWidget.content.headline.trim()) {
        return newsWidget.content.headline;
    }
    const weatherWidget = widgets.find(function findWeatherWidget(widget) {
        return widget.widgetType === 'weather' && widget.status === 'READY';
    });
    if (weatherWidget && typeof weatherWidget.content.summary === 'string') {
        return weatherWidget.content.summary;
    }
    const taskWidget = widgets.find(function findTaskWidget(widget) {
        return widget.widgetType === 'tasks' && widget.status === 'READY';
    });
    if (taskWidget) {
        const taskCount = countTaskItems(taskWidget.content.groups);
        return taskCount
            ? `${taskCount} tasks loaded from Todoist.`
            : 'No Todoist tasks are due today, tomorrow, or without a due date.';
    }
    const calendarWidget = widgets.find(function findCalendarWidget(widget) {
        return widget.widgetType === 'calendar' && widget.status === 'READY';
    });
    if (calendarWidget) {
        const appointmentCount = countCalendarAppointments(calendarWidget.content.appointments);
        return appointmentCount
            ? `${appointmentCount} appointments loaded from Google Calendar.`
            : 'No Google Calendar appointments are scheduled for today.';
    }
    const xkcdWidget = widgets.find(function findXkcdWidget(widget) {
        return widget.widgetType === 'xkcd' && widget.status === 'READY';
    });
    if (xkcdWidget && typeof xkcdWidget.content.title === 'string' && xkcdWidget.content.title.trim()) {
        return `Latest xkcd: ${xkcdWidget.content.title}.`;
    }
    return 'Latest dashboard snapshot generated.';
}
function toResponse(snapshot) {
    return {
        id: snapshot.id,
        dashboardId: snapshot.dashboardId,
        snapshotDate: snapshot.snapshotDate,
        generationStatus: snapshot.generationStatus,
        summary: snapshot.summary,
        generatedAt: snapshot.generatedAt.toISOString(),
        widgets: snapshot.widgets.map(function mapWidget(widget) {
            return {
                widgetId: widget.widgetId,
                widgetType: widget.widgetType,
                title: widget.title,
                status: widget.status,
                content: widget.content,
                errorMessage: widget.errorMessage,
                generatedAt: widget.generatedAt.toISOString()
            };
        })
    };
}
function getConnectorApiKey(config) {
    if (typeof config.apiKey === 'string' && config.apiKey.trim()) {
        return config.apiKey.trim();
    }
    return '';
}
function getOpenAiModel(config) {
    if (typeof config.model === 'string' && config.model.trim()) {
        return config.model.trim();
    }
    return 'gpt-5-mini';
}
function getOpenAiBaseUrl(config) {
    if (typeof config.baseUrl === 'string' && config.baseUrl.trim()) {
        return config.baseUrl.trim().replace(/\/$/, '');
    }
    return 'https://api.openai.com';
}
function getGoogleCalendarId(config) {
    if (typeof config.calendarId === 'string' && config.calendarId.trim()) {
        return config.calendarId.trim();
    }
    return '';
}
function getGoogleCalendarAccessToken(config) {
    if (typeof config.accessToken === 'string' && config.accessToken.trim()) {
        return config.accessToken.trim();
    }
    return '';
}
function getGoogleCalendarRefreshToken(config) {
    if (typeof config.refreshToken === 'string' && config.refreshToken.trim()) {
        return config.refreshToken.trim();
    }
    return '';
}
function classifySnapshotFailureLevel(errorMessage) {
    const normalized = (errorMessage || '').toLowerCase();
    if (normalized.includes('missing') ||
        normalized.includes('unsupported') ||
        normalized.includes('required') ||
        normalized.includes('not found') ||
        normalized.includes('stale')) {
        return 'warn';
    }
    return 'error';
}
function isTokenExpired(config) {
    if (typeof config.expiresAt !== 'string' || !config.expiresAt.trim()) {
        return true;
    }
    return Date.parse(config.expiresAt) <= Date.now() + 60_000;
}
function buildTaskSnapshotContent(tasks, generatedAt, connectionName) {
    const today = formatDateKey(generatedAt);
    const tomorrow = formatDateKey(addDays(generatedAt, 1));
    const todayItems = [];
    const tomorrowItems = [];
    const undatedItems = [];
    tasks.forEach(function groupTask(task) {
        const item = toTaskSnapshotItem(task);
        if (!task.due || !task.due.date) {
            undatedItems.push(item);
            return;
        }
        if (task.due.date <= today) {
            todayItems.push(item);
            return;
        }
        if (task.due.date === tomorrow) {
            tomorrowItems.push(item);
        }
    });
    return {
        provider: 'todoist',
        connectionLabel: connectionName,
        groups: [
            { label: 'Due Today', items: todayItems },
            { label: 'Due Tomorrow', items: tomorrowItems },
            { label: 'No Due Date', items: undatedItems }
        ],
        emptyMessage: countTaskItems([
            { items: todayItems },
            { items: tomorrowItems },
            { items: undatedItems }
        ])
            ? ''
            : 'No incomplete tasks are due today, tomorrow, or without a due date.'
    };
}
function toTaskSnapshotItem(task) {
    return {
        id: task.id,
        title: task.content,
        meta: buildTaskMeta(task),
        isRecurring: !!(task.due && task.due.isRecurring),
        url: task.url || ''
    };
}
function buildCalendarSnapshotContent(events, connectionName) {
    return {
        provider: 'google-calendar',
        connectionLabel: connectionName,
        dateLabel: 'Today',
        appointments: events.map(function mapEvent(event) {
            return {
                id: event.id,
                time: event.timeLabel,
                title: event.title,
                location: event.location,
                isAllDay: event.isAllDay,
                url: event.url
            };
        }),
        emptyMessage: events.length
            ? ''
            : 'No appointments are scheduled for today.'
    };
}
function buildTaskMeta(task) {
    const parts = [];
    if (task.due && typeof task.due.string === 'string' && task.due.string.trim()) {
        parts.push(task.due.string.trim());
    }
    if (task.due && task.due.isRecurring) {
        parts.push('Recurring');
    }
    return parts.join(' • ');
}
function countTaskItems(groups) {
    if (!Array.isArray(groups)) {
        return 0;
    }
    return groups.reduce(function count(total, group) {
        if (!group || typeof group !== 'object' || !Array.isArray(group.items)) {
            return total;
        }
        return total + group.items.length;
    }, 0);
}
function countCalendarAppointments(appointments) {
    if (!Array.isArray(appointments)) {
        return 0;
    }
    return appointments.length;
}
function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
function flattenPreparedNewsCategories(categories) {
    return categories.flatMap(function mapCategory(category) {
        return category.articles.map(function mapArticle(article) {
            return {
                articleKey: buildNewsArticleKey(article),
                categoryName: category.name,
                categoryDescription: category.description,
                title: article.title,
                url: article.url,
                summary: article.summary,
                sourceName: article.sourceName,
                publishedAt: article.publishedAt
            };
        });
    });
}
function restorePreparedNewsCategories(items) {
    const categories = new Map();
    items.forEach(function groupItem(item) {
        const existingCategory = categories.get(item.categoryName);
        if (existingCategory) {
            existingCategory.articles.push({
                title: item.title,
                url: item.url,
                summary: item.summary,
                sourceName: item.sourceName,
                publishedAt: item.publishedAt
            });
            return;
        }
        categories.set(item.categoryName, {
            name: item.categoryName,
            description: item.categoryDescription,
            articles: [
                {
                    title: item.title,
                    url: item.url,
                    summary: item.summary,
                    sourceName: item.sourceName,
                    publishedAt: item.publishedAt
                }
            ]
        });
    });
    return Array.from(categories.values());
}
function dedupeArticlesByKey(items) {
    const seen = new Set();
    return items.filter(function filterItem(item) {
        const key = buildNewsArticleKey(item);
        if (!key || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function buildNewsArticleKey(item) {
    if (item.url && item.url.trim()) {
        return item.url.trim().toLowerCase();
    }
    return [
        item.title.trim().toLowerCase(),
        item.sourceName.trim().toLowerCase(),
        item.publishedAt || ''
    ].join('|');
}
function compareArticlesByDateDesc(left, right) {
    const leftTimestamp = left.publishedAt ? Date.parse(left.publishedAt) : 0;
    const rightTimestamp = right.publishedAt ? Date.parse(right.publishedAt) : 0;
    return rightTimestamp - leftTimestamp;
}
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
