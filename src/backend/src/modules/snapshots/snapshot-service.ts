import type { GmailOAuthClient } from '../connections/gmail-oauth-client.js';
import type { GoogleCalendarOAuthClient } from '../connections/google-calendar-oauth-client.js';
import { logApplicationEvent } from '../admin/application-logger.js';
import type { DefaultUserContext } from '../default-user/default-user-service.js';
import type { RssFeedRepository } from '../rss-feeds/rss-feed-repository.js';
import type { TenantAiConfigurationService } from '../tenant-ai-configuration/tenant-ai-configuration-service.js';
import type { DashboardWidgetRecord } from '../widgets/widget-types.js';
import type { GmailClient, GmailMessage } from './gmail-client.js';
import type { GoogleCalendarClient, GoogleCalendarEvent } from './google-calendar-client.js';
import type { OpenAiNewsSummarizer } from './openai-news-summarizer.js';
import type { WeatherClient } from './open-meteo-weather-client.js';
import type { ParsedRssArticle, RssFeedClient } from './rss-feed-client.js';
import type { GenerateWidgetSnapshotRequested } from './snapshot-job-types.js';
import type { TodoistTask, TodoistTaskClient } from './todoist-task-client.js';
import type { PersistedNewsArticleRecord, SnapshotRepository } from './snapshot-repository.js';
import { XkcdClientImpl, type XkcdClient } from './xkcd-client.js';
import { NatGeoDailyPhotoClientImpl, type NatGeoDailyPhotoClient } from './natgeo-daily-photo-client.js';
import type {
  DashboardSnapshotRecord,
  DashboardSnapshotResponse,
  DashboardSnapshotWidgetRecord
} from './snapshot-types.js';

export class SnapshotService {
  constructor(
    private readonly repository: SnapshotRepository,
    private readonly rssFeedRepository: Pick<RssFeedRepository, 'listCategories'>,
    private readonly weatherClient: WeatherClient,
    private readonly todoistTaskClient: TodoistTaskClient,
    private readonly googleCalendarClient: GoogleCalendarClient,
    private readonly googleCalendarOAuthClient: Pick<GoogleCalendarOAuthClient, 'refreshAccessToken'>,
    private readonly gmailClient: GmailClient = {
      async listMessages() {
        throw new Error('Gmail is not configured.');
      }
    },
    private readonly gmailOAuthClient: Pick<GmailOAuthClient, 'refreshAccessToken'> = {
      async refreshAccessToken() {
        throw new Error('Gmail is not configured.');
      }
    },
    private readonly rssFeedClient: Pick<RssFeedClient, 'fetchFeed'>,
    private readonly openAiNewsSummarizer: Pick<OpenAiNewsSummarizer, 'summarize'>,
    private readonly xkcdClient: Pick<XkcdClient, 'getLatestComic'> = new XkcdClientImpl(),
    private readonly tenantAiConfigurationService: Pick<TenantAiConfigurationService, 'getRequiredOpenAiConfiguration'> = {
      async getRequiredOpenAiConfiguration() {
        throw new Error('OpenAI configuration is missing. Add the API key in Admin > Configuration.');
      }
    },
    private readonly natGeoDailyPhotoClient: Pick<NatGeoDailyPhotoClient, 'getDailyPhoto'> = new NatGeoDailyPhotoClientImpl()
  ) {}

  async generateForWidget(message: GenerateWidgetSnapshotRequested): Promise<{
    status: 'generated' | 'skipped';
    reason?: 'widget_not_found' | 'widget_not_visible' | 'widget_not_snapshot_based' | 'stale_message';
  }> {
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

  async getPersistedLatestForDashboard(
    dashboardId: string,
    user: DefaultUserContext
  ): Promise<DashboardSnapshotResponse | null> {
    const snapshot = await this.repository.findLatestDashboardSnapshot(dashboardId, user.userId);

    return snapshot ? toResponse(snapshot) : null;
  }

  async getLatestForDashboard(dashboardId: string, user: DefaultUserContext): Promise<DashboardSnapshotResponse | null> {
    const dashboard = await this.repository.findDashboardWithWidgets(dashboardId, user.userId);

    if (!dashboard) {
      return null;
    }

    const generatedAt = new Date();
    const widgetSnapshots: DashboardSnapshotWidgetRecord[] = [];

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

  private logWidgetSnapshotFailureIfNeeded(
    widget: DashboardWidgetRecord,
    widgetSnapshot: DashboardSnapshotWidgetRecord,
    extraContext: Record<string, unknown>
  ): void {
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

  private logSnapshotProgress(event: string, message: string, context: Record<string, unknown>): void {
    logApplicationEvent({
      level: 'info',
      scope: 'snapshot-service',
      event,
      message,
      context
    });
  }

  private async buildWidgetSnapshot(widget: DashboardWidgetRecord, generatedAt: Date): Promise<DashboardSnapshotWidgetRecord> {
    if (widget.type === 'news') {
      return this.buildNewsWidgetSnapshot(widget, generatedAt);
    }

    if (widget.type === 'xkcd') {
      return this.buildXkcdWidgetSnapshot(widget, generatedAt);
    }

    if (widget.type === 'natgeo-daily-photo') {
      return this.buildNatGeoDailyPhotoWidgetSnapshot(widget, generatedAt);
    }

    if (widget.type === 'calendar') {
      return this.buildCalendarWidgetSnapshot(widget, generatedAt);
    }

    if (widget.type === 'email') {
      return this.buildEmailWidgetSnapshot(widget, generatedAt);
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
    } catch (error) {
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

  private async buildXkcdWidgetSnapshot(widget: DashboardWidgetRecord, generatedAt: Date): Promise<DashboardSnapshotWidgetRecord> {
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
    } catch (error) {
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

  private async buildNewsWidgetSnapshot(widget: DashboardWidgetRecord, generatedAt: Date): Promise<DashboardSnapshotWidgetRecord> {
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

    let openAiConfiguration;

    try {
      openAiConfiguration = await this.tenantAiConfigurationService.getRequiredOpenAiConfiguration(widget.tenantId);
    } catch (error) {
      return {
        widgetId: widget.id,
        widgetType: widget.type,
        title: widget.title,
        status: 'FAILED',
        content: {
          headline: 'OpenAI configuration required.',
          markdown: '# OpenAI configuration required.\n\nAdd the tenant OpenAI API key in Admin > Configuration to generate a news snapshot.',
          categories: [],
          emptyMessage: 'Add the tenant OpenAI configuration in Admin > Configuration.',
          sourceErrors: []
        },
        errorMessage: error instanceof Error ? error.message : 'OpenAI configuration is missing.',
        generatedAt
      };
    }

    const sourceErrors: string[] = [];
    let preparedCategories: Array<{
      name: string;
      description: string;
      articles: ParsedRssArticle[];
    }> = [];
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
    } else {
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
        const categoryArticles: ParsedRssArticle[] = [];

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
          } catch (error) {
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
        provider: 'openai',
        connectionId: null,
        connectionName: 'Tenant AI Configuration',
        model: openAiConfiguration.model,
        baseUrl: 'https://api.openai.com',
        categoryCount: preparedCategories.length,
        articleCount: preparedCategories.reduce(function countArticles(total, category) {
          return total + category.articles.length;
        }, 0),
        sourceErrorCount: sourceErrors.length
      });
      const summary = await this.openAiNewsSummarizer.summarize({
        apiKey: openAiConfiguration.apiKey,
        model: openAiConfiguration.model,
        baseUrl: 'https://api.openai.com',
        snapshotDate,
        categories: preparedCategories
      });
      this.logSnapshotProgress('news_summary_completed', 'News summary generated successfully.', {
        widgetId: widget.id,
        widgetType: widget.type,
        widgetTitle: widget.title,
        dashboardId: widget.dashboardId,
        tenantId: widget.tenantId,
        provider: 'openai',
        connectionId: null,
        connectionName: 'Tenant AI Configuration',
        model: openAiConfiguration.model,
        baseUrl: 'https://api.openai.com',
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'News snapshot generation failed.';
      this.logSnapshotProgress('news_summary_failed', 'News summary generation failed.', {
        widgetId: widget.id,
        widgetType: widget.type,
        widgetTitle: widget.title,
        dashboardId: widget.dashboardId,
        tenantId: widget.tenantId,
        provider: 'openai',
        connectionId: null,
        connectionName: 'Tenant AI Configuration',
        model: openAiConfiguration.model,
        baseUrl: 'https://api.openai.com',
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

  private async buildNatGeoDailyPhotoWidgetSnapshot(
    widget: DashboardWidgetRecord,
    generatedAt: Date
  ): Promise<DashboardSnapshotWidgetRecord> {
    try {
      const photo = await this.natGeoDailyPhotoClient.getDailyPhoto();

      return {
        widgetId: widget.id,
        widgetType: widget.type,
        title: widget.title,
        status: 'READY',
        content: {
          title: photo.title,
          description: photo.description,
          imageUrl: photo.imageUrl,
          altText: photo.altText,
          permalink: photo.permalink,
          credit: photo.credit,
          emptyMessage: ''
        },
        errorMessage: null,
        generatedAt
      };
    } catch (error) {
      return {
        widgetId: widget.id,
        widgetType: widget.type,
        title: widget.title,
        status: 'FAILED',
        content: {
          title: 'NatGeo Daily Photo unavailable',
          description: 'The latest National Geographic Photo of the Day could not be loaded right now.',
          imageUrl: '',
          altText: 'The latest National Geographic Photo of the Day could not be loaded right now.',
          permalink: 'https://www.nationalgeographic.com/photo-of-the-day/',
          credit: '',
          emptyMessage: 'The latest National Geographic Photo of the Day could not be loaded right now. Please try again.'
        },
        errorMessage: error instanceof Error ? error.message : 'NatGeo Daily Photo snapshot generation failed.',
        generatedAt
      };
    }
  }

  private async buildTaskWidgetSnapshot(widget: DashboardWidgetRecord, generatedAt: Date): Promise<DashboardSnapshotWidgetRecord> {
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
        content: buildTaskSnapshotContent(
          tasks,
          generatedAt,
          connector.connector.name,
          shouldShowUndatedTasks(widget.config)
        ),
        errorMessage: null,
        generatedAt: generatedAt
      };
    } catch (error) {
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

  private async buildCalendarWidgetSnapshot(widget: DashboardWidgetRecord, generatedAt: Date): Promise<DashboardSnapshotWidgetRecord> {
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
    } catch (error) {
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

  private async buildEmailWidgetSnapshot(widget: DashboardWidgetRecord, generatedAt: Date): Promise<DashboardSnapshotWidgetRecord> {
    const connector = widget.connections.find(function findConnector(item) {
      return item.usageRole === 'email';
    });
    const filters = getEmailFilters(widget.config);

    if (!connector) {
      return {
        widgetId: widget.id,
        widgetType: widget.type,
        title: widget.title,
        status: 'FAILED',
        content: {
          provider: 'gmail',
          connectionLabel: 'Not connected',
          filters,
          messages: [],
          emptyMessage: 'Choose a Gmail connection in edit mode to configure this widget.'
        },
        errorMessage: 'Email widget is missing a configured connection.',
        generatedAt
      };
    }

    if (connector.connector.type !== 'gmail') {
      return {
        widgetId: widget.id,
        widgetType: widget.type,
        title: widget.title,
        status: 'FAILED',
        content: {
          provider: connector.connector.type,
          connectionLabel: connector.connector.name,
          filters,
          messages: [],
          emptyMessage: 'The selected email provider is not supported yet.'
        },
        errorMessage: 'Email widget is configured with an unsupported provider.',
        generatedAt
      };
    }

    const accessToken = getOAuthAccessToken(connector.connector.config);
    const refreshToken = getOAuthRefreshToken(connector.connector.config);
    const accountEmail = getGmailAccountEmail(connector.connector.config);

    if (connector.connector.authType !== 'OAUTH') {
      return {
        widgetId: widget.id,
        widgetType: widget.type,
        title: widget.title,
        status: 'FAILED',
        content: {
          provider: 'gmail',
          connectionLabel: connector.connector.name,
          filters,
          messages: [],
          emptyMessage: 'This Gmail connection needs OAuth access before it can load private messages.'
        },
        errorMessage: 'Gmail connection is using an unsupported authentication mode.',
        generatedAt
      };
    }

    if (!refreshToken) {
      return {
        widgetId: widget.id,
        widgetType: widget.type,
        title: widget.title,
        status: 'FAILED',
        content: {
          provider: 'gmail',
          connectionLabel: connector.connector.name,
          filters,
          messages: [],
          emptyMessage: 'The selected Gmail connection is missing its refresh token.'
        },
        errorMessage: 'Gmail connection is missing a refresh token.',
        generatedAt
      };
    }

    if (!accountEmail) {
      return {
        widgetId: widget.id,
        widgetType: widget.type,
        title: widget.title,
        status: 'FAILED',
        content: {
          provider: 'gmail',
          connectionLabel: connector.connector.name,
          filters,
          messages: [],
          emptyMessage: 'The selected Gmail connection is missing its account email.'
        },
        errorMessage: 'Gmail connection is missing an account email.',
        generatedAt
      };
    }

    try {
      const token = accessToken && !isTokenExpired(connector.connector.config)
        ? {
            accessToken
          }
        : await this.gmailOAuthClient.refreshAccessToken(refreshToken);
      const messages = await this.gmailClient.listMessages(token.accessToken, filters);

      return {
        widgetId: widget.id,
        widgetType: widget.type,
        title: widget.title,
        status: 'READY',
        content: buildEmailSnapshotContent(messages, connector.connector.name, filters),
        errorMessage: null,
        generatedAt
      };
    } catch (error) {
      return {
        widgetId: widget.id,
        widgetType: widget.type,
        title: widget.title,
        status: 'FAILED',
        content: {
          provider: 'gmail',
          connectionLabel: connector.connector.name,
          filters,
          messages: [],
          emptyMessage: 'Gmail could not be reached. Please check the connection and try again.'
        },
        errorMessage: error instanceof Error ? error.message : 'Gmail snapshot generation failed.',
        generatedAt
      };
    }
  }
}

function getWeatherLocation(config: Record<string, unknown>): {
  latitude: number;
  longitude: number;
  timezone: string;
  displayName: string;
} | null {
  if (!config.location || typeof config.location !== 'object') {
    return null;
  }

  const location = config.location as {
    latitude?: unknown;
    longitude?: unknown;
    timezone?: unknown;
    displayName?: unknown;
    name?: unknown;
    countryCode?: unknown;
  };

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

function getLocationLabel(location: {
  displayName?: unknown;
  name?: unknown;
  countryCode?: unknown;
}): string {
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

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildSummary(widgets: DashboardSnapshotWidgetRecord[]): string {
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

  const emailWidget = widgets.find(function findEmailWidget(widget) {
    return widget.widgetType === 'email' && widget.status === 'READY';
  });

  if (emailWidget) {
    const emailCount = countEmailMessages(emailWidget.content.messages);
    const unreadCount = countUnreadEmailMessages(emailWidget.content.messages);

    return emailCount
      ? `${emailCount} email messages loaded from Gmail, ${unreadCount} unread.`
      : 'No Gmail messages matched the configured filters.';
  }

  const xkcdWidget = widgets.find(function findXkcdWidget(widget) {
    return widget.widgetType === 'xkcd' && widget.status === 'READY';
  });

  if (xkcdWidget && typeof xkcdWidget.content.title === 'string' && xkcdWidget.content.title.trim()) {
    return `Latest xkcd: ${xkcdWidget.content.title}.`;
  }

  const natGeoWidget = widgets.find(function findNatGeoWidget(widget) {
    return widget.widgetType === 'natgeo-daily-photo' && widget.status === 'READY';
  });

  if (natGeoWidget && typeof natGeoWidget.content.title === 'string' && natGeoWidget.content.title.trim()) {
    return `NatGeo Daily Photo: ${natGeoWidget.content.title}.`;
  }

  return 'Latest dashboard snapshot generated.';
}

function toResponse(snapshot: DashboardSnapshotRecord): DashboardSnapshotResponse {
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

function getConnectorApiKey(config: Record<string, unknown>): string {
  if (typeof config.apiKey === 'string' && config.apiKey.trim()) {
    return config.apiKey.trim();
  }

  return '';
}

function getGoogleCalendarId(config: Record<string, unknown>): string {
  if (typeof config.calendarId === 'string' && config.calendarId.trim()) {
    return config.calendarId.trim();
  }

  return '';
}

function getGoogleCalendarAccessToken(config: Record<string, unknown>): string {
  return getOAuthAccessToken(config);
}

function getOAuthAccessToken(config: Record<string, unknown>): string {
  if (typeof config.accessToken === 'string' && config.accessToken.trim()) {
    return config.accessToken.trim();
  }

  return '';
}

function getGoogleCalendarRefreshToken(config: Record<string, unknown>): string {
  return getOAuthRefreshToken(config);
}

function getOAuthRefreshToken(config: Record<string, unknown>): string {
  if (typeof config.refreshToken === 'string' && config.refreshToken.trim()) {
    return config.refreshToken.trim();
  }

  return '';
}

function getGmailAccountEmail(config: Record<string, unknown>): string {
  if (typeof config.accountEmail === 'string' && config.accountEmail.trim()) {
    return config.accountEmail.trim();
  }

  return '';
}

function classifySnapshotFailureLevel(errorMessage: string | null): 'warn' | 'error' {
  const normalized = (errorMessage || '').toLowerCase();

  if (
    normalized.includes('missing') ||
    normalized.includes('unsupported') ||
    normalized.includes('required') ||
    normalized.includes('not found') ||
    normalized.includes('stale')
  ) {
    return 'warn';
  }

  return 'error';
}

function isTokenExpired(config: Record<string, unknown>): boolean {
  if (typeof config.expiresAt !== 'string' || !config.expiresAt.trim()) {
    return true;
  }

  return Date.parse(config.expiresAt) <= Date.now() + 60_000;
}

function buildTaskSnapshotContent(
  tasks: TodoistTask[],
  generatedAt: Date,
  connectionName: string,
  includeUndatedItems: boolean
): Record<string, unknown> {
  const today = formatDateKey(generatedAt);
  const tomorrow = formatDateKey(addDays(generatedAt, 1));
  const todayItems: Array<Record<string, unknown>> = [];
  const tomorrowItems: Array<Record<string, unknown>> = [];
  const undatedItems: Array<Record<string, unknown>> = [];

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
    groups: buildTaskGroups(todayItems, tomorrowItems, undatedItems, includeUndatedItems),
    emptyMessage: countTaskItems(buildTaskGroups(todayItems, tomorrowItems, undatedItems, includeUndatedItems))
      ? ''
      : includeUndatedItems
        ? 'No incomplete tasks are due today, tomorrow, or without a due date.'
        : 'No incomplete tasks are due today or tomorrow.'
  };
}

function toTaskSnapshotItem(task: TodoistTask): Record<string, unknown> {
  return {
    id: task.id,
    title: task.content,
    meta: buildTaskMeta(task),
    isRecurring: !!(task.due && task.due.isRecurring),
    url: task.url || ''
  };
}

function buildCalendarSnapshotContent(events: GoogleCalendarEvent[], connectionName: string): Record<string, unknown> {
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

function buildEmailSnapshotContent(messages: GmailMessage[], connectionName: string, filters: string[]): Record<string, unknown> {
  return {
    provider: 'gmail',
    connectionLabel: connectionName,
    filters,
    messages: messages.slice(0, 25).map(function mapMessage(message) {
      return {
        id: message.id,
        threadId: message.threadId,
        subject: message.subject,
        from: message.from,
        snippet: message.snippet,
        receivedAt: message.receivedAt,
        isUnread: message.isUnread,
        matchedFilters: message.matchedFilters,
        url: message.webUrl
      };
    }),
    emptyMessage: messages.length
      ? ''
      : 'No messages matched the configured filters.'
  };
}

function buildTaskMeta(task: TodoistTask): string {
  const parts: string[] = [];

  if (task.due && typeof task.due.string === 'string' && task.due.string.trim()) {
    parts.push(task.due.string.trim());
  }

  if (task.due && task.due.isRecurring) {
    parts.push('Recurring');
  }

  return parts.join(' • ');
}

function countTaskItems(groups: unknown): number {
  if (!Array.isArray(groups)) {
    return 0;
  }

  return groups.reduce(function count(total, group) {
    if (!group || typeof group !== 'object' || !Array.isArray((group as { items?: unknown[] }).items)) {
      return total;
    }

    return total + (group as { items: unknown[] }).items.length;
  }, 0);
}

function shouldShowUndatedTasks(config: Record<string, unknown>): boolean {
  return config.showUndatedTasks !== false;
}

function getEmailFilters(config: Record<string, unknown>): string[] {
  if (!Array.isArray(config.filters)) {
    return ['in:inbox'];
  }

  const filters = config.filters.filter(function filterValue(value) {
    return typeof value === 'string' && value.trim();
  }).map(function mapValue(value) {
    return (value as string).trim();
  });

  return filters.length ? filters : ['in:inbox'];
}

function buildTaskGroups(
  todayItems: Array<Record<string, unknown>>,
  tomorrowItems: Array<Record<string, unknown>>,
  undatedItems: Array<Record<string, unknown>>,
  includeUndatedItems: boolean
): Array<{ label: string; items: Array<Record<string, unknown>> }> {
  const groups: Array<{ label: string; items: Array<Record<string, unknown>> }> = [
    { label: 'Due Today', items: todayItems },
    { label: 'Due Tomorrow', items: tomorrowItems }
  ];

  if (includeUndatedItems) {
    groups.push({ label: 'No Due Date', items: undatedItems });
  }

  return groups;
}

function countCalendarAppointments(appointments: unknown): number {
  if (!Array.isArray(appointments)) {
    return 0;
  }

  return appointments.length;
}

function countEmailMessages(messages: unknown): number {
  return Array.isArray(messages) ? messages.length : 0;
}

function countUnreadEmailMessages(messages: unknown): number {
  if (!Array.isArray(messages)) {
    return 0;
  }

  return messages.filter(function filterUnread(message) {
    return !!(message && typeof message === 'object' && (message as { isUnread?: unknown }).isUnread);
  }).length;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function flattenPreparedNewsCategories(categories: Array<{
  name: string;
  description: string;
  articles: ParsedRssArticle[];
}>): PersistedNewsArticleRecord[] {
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

function restorePreparedNewsCategories(items: PersistedNewsArticleRecord[]): Array<{
  name: string;
  description: string;
  articles: ParsedRssArticle[];
}> {
  const categories = new Map<string, {
    name: string;
    description: string;
    articles: ParsedRssArticle[];
  }>();

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

function dedupeArticlesByKey(items: ParsedRssArticle[]): ParsedRssArticle[] {
  const seen = new Set<string>();

  return items.filter(function filterItem(item) {
    const key = buildNewsArticleKey(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildNewsArticleKey(item: {
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string | null;
}): string {
  if (item.url && item.url.trim()) {
    return item.url.trim().toLowerCase();
  }

  return [
    item.title.trim().toLowerCase(),
    item.sourceName.trim().toLowerCase(),
    item.publishedAt || ''
  ].join('|');
}

function compareArticlesByDateDesc(left: ParsedRssArticle, right: ParsedRssArticle): number {
  const leftTimestamp = left.publishedAt ? Date.parse(left.publishedAt) : 0;
  const rightTimestamp = right.publishedAt ? Date.parse(right.publishedAt) : 0;

  return rightTimestamp - leftTimestamp;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
