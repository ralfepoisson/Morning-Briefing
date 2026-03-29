import type { GoogleCalendarOAuthClient } from '../connections/google-calendar-oauth-client.js';
import { listApplicationLogs, resetApplicationLogs } from '../admin/application-log-store.js';
import type { RssFeedRepository } from '../rss-feeds/rss-feed-repository.js';
import type { GmailOAuthClient } from '../connections/gmail-oauth-client.js';
import type { GmailClient } from './gmail-client.js';
import type { GoogleCalendarClient } from './google-calendar-client.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotService } from './snapshot-service.js';
import type {
  PersistedNewsArticleRecord,
  SnapshotRepository,
  SnapshotDashboardRecord,
  UpsertDashboardSnapshotInput,
  UpsertWidgetSnapshotInput,
  ClaimSnapshotJobResult
} from './snapshot-repository.js';
import type { DashboardSnapshotRecord, WeatherSnapshotData } from './snapshot-types.js';
import type { WeatherClient } from './open-meteo-weather-client.js';
import type { OpenAiNewsSummarizer } from './openai-news-summarizer.js';
import type { RssFeedClient } from './rss-feed-client.js';
import type { TodoistTaskClient } from './todoist-task-client.js';
import type { GenerateWidgetSnapshotRequested } from './snapshot-job-types.js';
import type { XkcdClient } from './xkcd-client.js';
import type { NatGeoDailyPhotoClient } from './natgeo-daily-photo-client.js';

test('SnapshotService generates and persists a weather snapshot for the dashboard', async function () {
  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-1',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'weather',
        title: 'Weather Outlook',
        x: 0,
        y: 0,
        width: 320,
        height: 360,
        minWidth: 320,
        minHeight: 360,
        isVisible: true,
        sortOrder: 1,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {
          location: {
            latitude: 47.75205,
            longitude: 7.32866,
            timezone: 'Europe/Paris',
            displayName: 'Mulhouse, FR'
          }
        },
        configHash: 'hash-weather',
        data: {},
        connections: [],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const weatherClient: WeatherClient = {
    async getSnapshot(input): Promise<WeatherSnapshotData> {
      assert.equal(input.locationLabel, 'Mulhouse, FR');

      return {
        location: 'Mulhouse, FR',
        temperature: '17°',
        condition: 'Partly cloudy',
        highLow: 'H: 20°  L: 10°',
        summary: 'Latest forecast from Open-Meteo for Mulhouse, FR.',
        details: [
          { label: 'Feels like', value: '16°' }
        ]
      };
    }
  };
  const todoistTaskClient: TodoistTaskClient = {
    async listTasks() {
      throw new Error('not used');
    }
  };
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    weatherClient,
    todoistTaskClient,
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer()
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.dashboardId, 'dash-1');
  assert.equal(snapshot && snapshot.generationStatus, 'READY');
  assert.equal(snapshot && snapshot.widgets.length, 1);
  assert.deepEqual(snapshot && snapshot.widgets[0].content, {
    location: 'Mulhouse, FR',
    temperature: '17°',
    condition: 'Partly cloudy',
    highLow: 'H: 20°  L: 10°',
    summary: 'Latest forecast from Open-Meteo for Mulhouse, FR.',
    details: [
      { label: 'Feels like', value: '16°' }
    ]
  });
});

test('SnapshotService returns a failed weather widget snapshot when location config is missing', async function () {
  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-1',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'weather',
        title: 'Weather Outlook',
        x: 0,
        y: 0,
        width: 320,
        height: 360,
        minWidth: 320,
        minHeight: 360,
        isVisible: true,
        sortOrder: 1,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {},
        configHash: 'hash-weather',
        data: {},
        connections: [],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const weatherClient: WeatherClient = {
    async getSnapshot() {
      throw new Error('not used');
    }
  };
  const todoistTaskClient: TodoistTaskClient = {
    async listTasks() {
      throw new Error('not used');
    }
  };
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    weatherClient,
    todoistTaskClient,
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer()
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.generationStatus, 'FAILED');
  assert.equal(snapshot && snapshot.widgets[0].status, 'FAILED');
  assert.equal(snapshot && snapshot.widgets[0].errorMessage, 'Weather widget is missing a configured city.');
});

test('SnapshotService generates a Todoist task snapshot for the dashboard', async function () {
  const today = formatDateKey(new Date());
  const tomorrow = formatDateKey(addDays(new Date(), 1));
  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-2',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'tasks',
        title: 'Task List',
        x: 0,
        y: 0,
        width: 360,
        height: 360,
        minWidth: 360,
        minHeight: 260,
        isVisible: true,
        sortOrder: 2,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {
          connectionId: 'connection-1',
          connectionName: 'Todoist',
          provider: 'todoist'
        },
        configHash: 'hash-tasks',
        data: {},
        connections: [
          {
            id: 'connection-1',
            usageRole: 'tasks',
            connector: {
              id: 'connection-1',
              type: 'todoist',
              name: 'Todoist',
              status: 'ACTIVE',
              authType: 'API_KEY',
              baseUrl: null,
              config: {
                apiKey: 'secret-token'
              },
              lastSyncAt: null,
              createdAt: new Date('2026-03-19T07:00:00.000Z'),
              updatedAt: new Date('2026-03-19T07:00:00.000Z')
            }
          }
        ],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const weatherClient: WeatherClient = {
    async getSnapshot() {
      throw new Error('not used');
    }
  };
  const todoistTaskClient: TodoistTaskClient = {
    async listTasks(apiKey) {
      assert.equal(apiKey, 'secret-token');

      return [
        {
          id: 'task-1',
          content: 'Reply to insurance email',
          due: {
            date: today,
            string: 'today',
            isRecurring: false
          }
        },
        {
          id: 'task-2',
          content: 'Buy birthday card',
          due: {
            date: tomorrow,
            string: 'tomorrow',
            isRecurring: true
          }
        },
        {
          id: 'task-3',
          content: 'Research standing desk options',
          due: null
        }
      ];
    }
  };
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    weatherClient,
    todoistTaskClient,
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer()
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.generationStatus, 'READY');
  assert.equal(snapshot && snapshot.widgets[0].widgetType, 'tasks');
  assert.deepEqual(snapshot && snapshot.widgets[0].content, {
    provider: 'todoist',
    connectionLabel: 'Todoist',
    groups: [
      {
        label: 'Due Today',
        items: [
          {
            id: 'task-1',
            title: 'Reply to insurance email',
            meta: 'today',
            isRecurring: false,
            url: ''
          }
        ]
      },
      {
        label: 'Due Tomorrow',
        items: [
          {
            id: 'task-2',
            title: 'Buy birthday card',
            meta: 'tomorrow • Recurring',
            isRecurring: true,
            url: ''
          }
        ]
      },
      {
        label: 'No Due Date',
        items: [
          {
            id: 'task-3',
            title: 'Research standing desk options',
            meta: '',
            isRecurring: false,
            url: ''
          }
        ]
      }
    ],
    emptyMessage: ''
  });
});

test('SnapshotService can hide undated Todoist tasks when the widget disables them', async function () {
  const today = formatDateKey(new Date());
  const tomorrow = formatDateKey(addDays(new Date(), 1));
  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-2',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'tasks',
        title: 'Task List',
        x: 0,
        y: 0,
        width: 360,
        height: 360,
        minWidth: 360,
        minHeight: 260,
        isVisible: true,
        sortOrder: 2,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {
          connectionId: 'connection-1',
          connectionName: 'Todoist',
          provider: 'todoist',
          showUndatedTasks: false
        },
        configHash: 'hash-tasks',
        data: {},
        connections: [
          {
            id: 'connection-1',
            usageRole: 'tasks',
            connector: {
              id: 'connection-1',
              type: 'todoist',
              name: 'Todoist',
              status: 'ACTIVE',
              authType: 'API_KEY',
              baseUrl: null,
              config: {
                apiKey: 'secret-token'
              },
              lastSyncAt: null,
              createdAt: new Date('2026-03-19T07:00:00.000Z'),
              updatedAt: new Date('2026-03-19T07:00:00.000Z')
            }
          }
        ],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const todoistTaskClient: TodoistTaskClient = {
    async listTasks() {
      return [
        {
          id: 'task-1',
          content: 'Reply to insurance email',
          due: {
            date: today,
            string: 'today',
            isRecurring: false
          }
        },
        {
          id: 'task-2',
          content: 'Buy birthday card',
          due: {
            date: tomorrow,
            string: 'tomorrow',
            isRecurring: false
          }
        },
        {
          id: 'task-3',
          content: 'Research standing desk options',
          due: null
        }
      ];
    }
  };
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    unusedWeatherClient(),
    todoistTaskClient,
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer()
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.deepEqual(snapshot && snapshot.widgets[0].content, {
    provider: 'todoist',
    connectionLabel: 'Todoist',
    groups: [
      {
        label: 'Due Today',
        items: [
          {
            id: 'task-1',
            title: 'Reply to insurance email',
            meta: 'today',
            isRecurring: false,
            url: ''
          }
        ]
      },
      {
        label: 'Due Tomorrow',
        items: [
          {
            id: 'task-2',
            title: 'Buy birthday card',
            meta: 'tomorrow',
            isRecurring: false,
            url: ''
          }
        ]
      }
    ],
    emptyMessage: ''
  });
});

test('SnapshotService generates a news snapshot from RSS feeds and the tenant OpenAI configuration', async function () {
  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-news',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        ownerPreferredLanguage: 'fr-FR',
        type: 'news',
        title: 'News Briefing',
        x: 0,
        y: 0,
        width: 420,
        height: 420,
        minWidth: 360,
        minHeight: 320,
        isVisible: true,
        sortOrder: 1,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {
          connectionId: 'connection-openai',
          connectionName: 'OpenAI',
          provider: 'openai'
        },
        configHash: 'hash-news',
        data: {},
        connections: [
          {
            id: 'connection-openai',
            usageRole: 'llm',
            connector: {
              id: 'connection-openai',
              type: 'openai',
              name: 'OpenAI',
              status: 'ACTIVE',
              authType: 'API_KEY',
              baseUrl: 'https://api.openai.com',
              config: {
                apiKey: 'openai-secret',
                model: 'gpt-5-mini',
                baseUrl: 'https://api.openai.com'
              },
              lastSyncAt: null,
              createdAt: new Date('2026-03-19T07:00:00.000Z'),
              updatedAt: new Date('2026-03-19T07:00:00.000Z')
            }
          }
        ],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const service = new SnapshotService(
    repository,
    {
      async listCategories() {
        return [
          {
            id: 'category-1',
            tenantId: 'tenant-1',
            name: 'Technology',
            description: 'AI and software',
            sortOrder: 1,
            feeds: [
              {
                id: 'feed-1',
                categoryId: 'category-1',
                name: 'Ars Technica',
                url: 'https://example.com/rss.xml',
                createdAt: new Date('2026-03-19T07:00:00.000Z'),
                updatedAt: new Date('2026-03-19T07:00:00.000Z')
              }
            ],
            createdAt: new Date('2026-03-19T07:00:00.000Z'),
            updatedAt: new Date('2026-03-19T07:00:00.000Z')
          }
        ];
      }
    },
    unusedWeatherClient(),
    unusedTodoistClient(),
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    {
      async fetchFeed(url) {
        assert.equal(url, 'https://example.com/rss.xml');

        return {
          sourceName: 'Ars Technica',
          items: [
            {
              title: 'Open source model release',
              url: 'https://example.com/article-1',
              summary: 'A notable local-model release shipped today.',
              publishedAt: '2026-03-20T07:00:00.000Z',
              sourceName: 'Ars Technica'
            }
          ]
        };
      }
    },
    {
      async summarize(input) {
        assert.equal(input.apiKey, 'tenant-openai-secret');
        assert.equal(input.model, 'gpt-5-mini');
        assert.equal(input.baseUrl, 'https://api.openai.com');
        assert.equal(input.preferredLanguage, 'fr-FR');
        assert.equal(input.categories.length, 1);
        assert.equal(input.categories[0].articles.length, 1);

        return {
          headline: 'Local AI tooling leads the morning briefing.',
          markdown: '# Local AI tooling leads the morning briefing.',
          categories: [
            {
              name: 'Technology',
              bullets: [
                {
                  headline: 'Open source model release',
                  summary: 'A notable local-model release shipped today.',
                  url: 'https://example.com/article-1',
                  sourceName: 'Ars Technica'
                }
              ]
            }
          ]
        };
      }
    },
    undefined,
    configuredTenantAiConfigurationService()
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.widgets[0].status, 'READY');
  assert.equal(snapshot && snapshot.widgets[0].content.headline, 'Local AI tooling leads the morning briefing.');
  assert.equal(snapshot && snapshot.widgets[0].content.categories[0].bullets.length, 1);
});

test('SnapshotService excludes previously considered news articles from a new day', async function () {
  const today = formatDateKey(new Date());
  const yesterday = formatDateKey(addDays(new Date(), -1));
  const repository = new InMemorySnapshotRepository(createNewsDashboardRecord());
  repository.newsArticleSelectionsByDate[yesterday] = [
    {
      articleKey: 'https://example.com/article-1',
      categoryName: 'Technology',
      categoryDescription: 'AI and software',
      title: 'Yesterday story',
      url: 'https://example.com/article-1',
      summary: 'Already considered yesterday.',
      sourceName: 'Ars Technica',
      publishedAt: '2026-03-19T07:00:00.000Z'
    }
  ];
  const service = new SnapshotService(
    repository,
    newsCategoryRepository(),
    unusedWeatherClient(),
    unusedTodoistClient(),
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    {
      async fetchFeed() {
        return {
          sourceName: 'Ars Technica',
          items: [
            {
              title: 'Yesterday story',
              url: 'https://example.com/article-1',
              summary: 'Already considered yesterday.',
              publishedAt: '2026-03-19T07:00:00.000Z',
              sourceName: 'Ars Technica'
            },
            {
              title: 'Fresh story',
              url: 'https://example.com/article-2',
              summary: 'New for today.',
              publishedAt: '2026-03-20T07:00:00.000Z',
              sourceName: 'Ars Technica'
            }
          ]
        };
      }
    },
    {
      async summarize(input) {
        assert.equal(input.preferredLanguage, 'fr-FR');
        assert.equal(input.categories.length, 1);
        assert.deepEqual(input.categories[0].articles.map(function mapArticle(article) {
          return article.url;
        }), ['https://example.com/article-2']);

        return {
          headline: 'Fresh story only.',
          markdown: '# Fresh story only.',
          categories: [
            {
              name: 'Technology',
              bullets: [
                {
                  headline: 'Fresh story',
                  summary: 'New for today.',
                  url: 'https://example.com/article-2',
                  sourceName: 'Ars Technica'
                }
              ]
            }
          ]
        };
      }
    },
    undefined,
    configuredTenantAiConfigurationService()
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.widgets[0].status, 'READY');
  assert.deepEqual(repository.newsArticleSelectionsByDate[today].map(function mapItem(item) {
    return item.url;
  }), ['https://example.com/article-2']);
});

test('SnapshotService reuses the same considered news article pool within a day', async function () {
  const today = formatDateKey(new Date());
  const repository = new InMemorySnapshotRepository(createNewsDashboardRecord());
  repository.newsArticleSelectionsByDate[today] = [
    {
      articleKey: 'https://example.com/article-2',
      categoryName: 'Technology',
      categoryDescription: 'AI and software',
      title: 'Locked story',
      url: 'https://example.com/article-2',
      summary: 'Reuse this article for every refresh today.',
      sourceName: 'Ars Technica',
      publishedAt: '2026-03-20T08:00:00.000Z'
    }
  ];
  const service = new SnapshotService(
    repository,
    newsCategoryRepository(),
    unusedWeatherClient(),
    unusedTodoistClient(),
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    {
      async fetchFeed() {
        throw new Error('RSS feeds should not be fetched when today\'s article pool is already locked.');
      }
    },
    {
      async summarize(input) {
        assert.equal(input.preferredLanguage, 'fr-FR');
        assert.equal(input.categories.length, 1);
        assert.deepEqual(input.categories[0].articles.map(function mapArticle(article) {
          return article.url;
        }), ['https://example.com/article-2']);

        return {
          headline: 'Locked story only.',
          markdown: '# Locked story only.',
          categories: [
            {
              name: 'Technology',
              bullets: [
                {
                  headline: 'Locked story',
                  summary: 'Reuse this article for every refresh today.',
                  url: 'https://example.com/article-2',
                  sourceName: 'Ars Technica'
                }
              ]
            }
          ]
        };
      }
    },
    undefined,
    configuredTenantAiConfigurationService()
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.widgets[0].status, 'READY');
  assert.deepEqual(repository.newsArticleSelectionsByDate[today].map(function mapItem(item) {
    return item.url;
  }), ['https://example.com/article-2']);
});

test('SnapshotService generates an xkcd snapshot for the dashboard', async function () {
  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-xkcd',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'xkcd',
        title: 'Latest xkcd',
        x: 0,
        y: 0,
        width: 420,
        height: 420,
        minWidth: 360,
        minHeight: 320,
        isVisible: true,
        sortOrder: 1,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {},
        configHash: 'hash-xkcd',
        data: {},
        connections: [],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    unusedWeatherClient(),
    unusedTodoistClient(),
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer(),
    {
      async getLatestComic() {
        return {
          id: 3221,
          title: 'Landscape Features',
          altText: 'Alt text',
          imageUrl: 'https://imgs.xkcd.com/comics/landscape_features.png',
          permalink: 'https://xkcd.com/3221/',
          publishedAt: '2026-03-20'
        };
      }
    }
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.generationStatus, 'READY');
  assert.equal(snapshot && snapshot.summary.headline, 'Latest xkcd: Landscape Features.');
  assert.deepEqual(snapshot && snapshot.widgets[0].content, {
    comicId: 3221,
    title: 'Landscape Features',
    altText: 'Alt text',
    imageUrl: 'https://imgs.xkcd.com/comics/landscape_features.png',
    permalink: 'https://xkcd.com/3221/',
    publishedAt: '2026-03-20',
    emptyMessage: ''
  });
});

test('SnapshotService returns a failed xkcd snapshot when the upstream request fails', async function () {
  resetApplicationLogs();

  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-xkcd',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'xkcd',
        title: 'Latest xkcd',
        x: 0,
        y: 0,
        width: 420,
        height: 420,
        minWidth: 360,
        minHeight: 320,
        isVisible: true,
        sortOrder: 1,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {},
        configHash: 'hash-xkcd',
        data: {},
        connections: [],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    unusedWeatherClient(),
    unusedTodoistClient(),
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer(),
    {
      async getLatestComic() {
        throw new Error('xkcd request failed with status 503.');
      }
    }
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });
  const logs = listApplicationLogs({
    levels: ['warn', 'error']
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.generationStatus, 'FAILED');
  assert.equal(snapshot && snapshot.widgets[0].errorMessage, 'xkcd request failed with status 503.');
  assert.deepEqual(snapshot && snapshot.widgets[0].content, {
    comicId: 0,
    title: 'Latest xkcd unavailable',
    altText: 'The latest xkcd comic could not be loaded right now.',
    imageUrl: '',
    permalink: 'https://xkcd.com/',
    publishedAt: '',
    emptyMessage: 'The latest xkcd comic could not be loaded right now. Please try again.'
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, 'widget_snapshot_failed');
  resetApplicationLogs();
});

test('SnapshotService generates a NatGeo Daily Photo snapshot for the dashboard', async function () {
  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-natgeo',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'natgeo-daily-photo',
        title: 'NatGeo Daily Photo',
        x: 0,
        y: 0,
        width: 420,
        height: 420,
        minWidth: 360,
        minHeight: 320,
        isVisible: true,
        sortOrder: 1,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {},
        configHash: 'hash-natgeo',
        data: {},
        connections: [],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    unusedWeatherClient(),
    unusedTodoistClient(),
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer(),
    undefined,
    undefined,
    {
      async getDailyPhoto() {
        return {
          title: 'Kyoto in Bloom',
          description: 'Passersby walk over a bridge framed by cherry blossoms in full bloom in Arashiyama, Kyoto.',
          imageUrl: 'https://i.natgeofe.com/n/ed73dbf1-1675-4a96-ba31-91f2f1f71649/-19-MM9908__220401_000403.jpg',
          altText: 'People walking over a bridge in front of blooming pink cherry blossoms.',
          permalink: 'https://www.nationalgeographic.com/photo-of-the-day/media-spotlight/cherry-blossoms-kyoto-japan',
          credit: 'Rinko Kawauchi, National Geographic Image Collection'
        };
      }
    }
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.generationStatus, 'READY');
  assert.equal(snapshot && snapshot.summary.headline, 'NatGeo Daily Photo: Kyoto in Bloom.');
  assert.deepEqual(snapshot && snapshot.widgets[0].content, {
    title: 'Kyoto in Bloom',
    description: 'Passersby walk over a bridge framed by cherry blossoms in full bloom in Arashiyama, Kyoto.',
    imageUrl: 'https://i.natgeofe.com/n/ed73dbf1-1675-4a96-ba31-91f2f1f71649/-19-MM9908__220401_000403.jpg',
    altText: 'People walking over a bridge in front of blooming pink cherry blossoms.',
    permalink: 'https://www.nationalgeographic.com/photo-of-the-day/media-spotlight/cherry-blossoms-kyoto-japan',
    credit: 'Rinko Kawauchi, National Geographic Image Collection',
    emptyMessage: ''
  });
});

test('SnapshotService returns a failed NatGeo Daily Photo snapshot when the upstream request fails', async function () {
  resetApplicationLogs();

  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-natgeo',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'natgeo-daily-photo',
        title: 'NatGeo Daily Photo',
        x: 0,
        y: 0,
        width: 420,
        height: 420,
        minWidth: 360,
        minHeight: 320,
        isVisible: true,
        sortOrder: 1,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {},
        configHash: 'hash-natgeo',
        data: {},
        connections: [],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    unusedWeatherClient(),
    unusedTodoistClient(),
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer(),
    undefined,
    undefined,
    {
      async getDailyPhoto() {
        throw new Error('NatGeo Daily Photo request failed with status 503.');
      }
    }
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });
  const logs = listApplicationLogs({
    levels: ['warn', 'error']
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.generationStatus, 'FAILED');
  assert.equal(snapshot && snapshot.widgets[0].errorMessage, 'NatGeo Daily Photo request failed with status 503.');
  assert.deepEqual(snapshot && snapshot.widgets[0].content, {
    title: 'NatGeo Daily Photo unavailable',
    description: 'The latest National Geographic Photo of the Day could not be loaded right now.',
    imageUrl: '',
    altText: 'The latest National Geographic Photo of the Day could not be loaded right now.',
    permalink: 'https://www.nationalgeographic.com/photo-of-the-day/',
    credit: '',
    emptyMessage: 'The latest National Geographic Photo of the Day could not be loaded right now. Please try again.'
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, 'widget_snapshot_failed');
  resetApplicationLogs();
});

test('SnapshotService generates a Google Calendar snapshot for the dashboard', async function () {
  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-3',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'calendar',
        title: 'Today on Calendar',
        x: 0,
        y: 0,
        width: 360,
        height: 360,
        minWidth: 360,
        minHeight: 260,
        isVisible: true,
        sortOrder: 3,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {
          connectionId: 'connection-2',
          connectionName: 'Google Calendar',
          provider: 'google-calendar'
        },
        configHash: 'hash-calendar',
        data: {},
        connections: [
          {
            id: 'connection-2',
            usageRole: 'calendar',
            connector: {
              id: 'connection-2',
              type: 'google-calendar',
              name: 'Google Calendar',
              status: 'ACTIVE',
              authType: 'OAUTH',
              baseUrl: null,
              config: {
                accessToken: '',
                refreshToken: 'google-refresh-token',
                expiresAt: '2026-03-19T07:00:00.000Z',
                calendarId: 'team@example.com'
              },
              lastSyncAt: null,
              createdAt: new Date('2026-03-19T07:00:00.000Z'),
              updatedAt: new Date('2026-03-19T07:00:00.000Z')
            }
          }
        ],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const weatherClient: WeatherClient = {
    async getSnapshot() {
      throw new Error('not used');
    }
  };
  const todoistTaskClient: TodoistTaskClient = {
    async listTasks() {
      throw new Error('not used');
    }
  };
  const googleCalendarClient: GoogleCalendarClient = {
    async listEvents(accessToken, calendarId) {
      assert.equal(accessToken, 'google-refreshed-token');
      assert.equal(calendarId, 'team@example.com');

      return [
        {
          id: 'event-1',
          title: 'Stand-up',
          location: 'Teams',
          url: 'https://calendar.google.com/event?eid=1',
          isAllDay: false,
          timeLabel: '09:00'
        },
        {
          id: 'event-2',
          title: 'Lunch',
          location: 'Cafe',
          url: '',
          isAllDay: false,
          timeLabel: '12:30'
        }
      ];
    }
  };
  const googleCalendarOAuthClient: Pick<GoogleCalendarOAuthClient, 'refreshAccessToken'> = {
    async refreshAccessToken(refreshToken) {
      assert.equal(refreshToken, 'google-refresh-token');

      return {
        accessToken: 'google-refreshed-token',
        expiresAt: '2026-03-20T12:00:00.000Z',
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        tokenType: 'Bearer'
      };
    }
  };
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    weatherClient,
    todoistTaskClient,
    googleCalendarClient,
    googleCalendarOAuthClient,
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer()
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.generationStatus, 'READY');
  assert.equal(snapshot && snapshot.widgets[0].widgetType, 'calendar');
  assert.deepEqual(snapshot && snapshot.widgets[0].content, {
    provider: 'google-calendar',
    connectionLabel: 'Google Calendar',
    dateLabel: 'Today',
    appointments: [
      {
        id: 'event-1',
        time: '09:00',
        title: 'Stand-up',
        location: 'Teams',
        isAllDay: false,
        url: 'https://calendar.google.com/event?eid=1'
      },
      {
        id: 'event-2',
        time: '12:30',
        title: 'Lunch',
        location: 'Cafe',
        isAllDay: false,
        url: ''
      }
    ],
    emptyMessage: ''
  });
});

test('SnapshotService logs Google Calendar snapshot failures for troubleshooting', async function () {
  resetApplicationLogs();

  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-3',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'calendar',
        title: 'Today on Calendar',
        x: 0,
        y: 0,
        width: 360,
        height: 360,
        minWidth: 360,
        minHeight: 260,
        isVisible: true,
        sortOrder: 3,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {
          connectionId: 'connection-2',
          connectionName: 'Google Calendar',
          provider: 'google-calendar'
        },
        configHash: 'hash-calendar',
        data: {},
        connections: [
          {
            id: 'connection-2',
            usageRole: 'calendar',
            connector: {
              id: 'connection-2',
              type: 'google-calendar',
              name: 'Google Calendar',
              status: 'ACTIVE',
              authType: 'OAUTH',
              baseUrl: null,
              config: {
                refreshToken: 'google-refresh-token',
                expiresAt: '2026-03-19T07:00:00.000Z',
                calendarId: 'team@example.com'
              },
              lastSyncAt: null,
              createdAt: new Date('2026-03-19T07:00:00.000Z'),
              updatedAt: new Date('2026-03-19T07:00:00.000Z')
            }
          }
        ],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    unusedWeatherClient(),
    unusedTodoistClient(),
    {
      async listEvents() {
        throw new Error('Google Calendar request failed with status 403.');
      }
    },
    {
      async refreshAccessToken() {
        return {
          accessToken: 'google-refreshed-token',
          expiresAt: '2026-03-20T12:00:00.000Z',
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          tokenType: 'Bearer'
        };
      }
    },
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer()
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });
  const logs = listApplicationLogs({
    levels: ['error']
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.generationStatus, 'FAILED');
  assert.equal(snapshot && snapshot.widgets[0].errorMessage, 'Google Calendar request failed with status 403.');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].scope, 'snapshot-service');
  assert.equal(logs[0].event, 'widget_snapshot_failed');
  assert.equal(logs[0].message, 'Google Calendar request failed with status 403.');
  assert.deepEqual(logs[0].context, {
    widgetId: 'widget-3',
    widgetType: 'calendar',
    widgetTitle: 'Today on Calendar',
    dashboardId: 'dash-1',
    tenantId: 'tenant-1',
    provider: 'google-calendar',
    connectionId: 'connection-2',
    connectionName: 'Google Calendar',
    errorMessage: 'Google Calendar request failed with status 403.',
    source: 'dashboard_refresh'
  });

  resetApplicationLogs();
});

test('SnapshotService generates a Gmail email snapshot for the dashboard', async function () {
  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-email-1',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        type: 'email',
        title: 'Recent Email',
        x: 0,
        y: 0,
        width: 420,
        height: 360,
        minWidth: 360,
        minHeight: 260,
        isVisible: true,
        sortOrder: 4,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {
          connectionId: 'connection-gmail-1',
          connectionName: 'Gmail',
          provider: 'gmail',
          filters: ['label:important', 'from:boss@example.com']
        },
        configHash: 'hash-email',
        data: {},
        connections: [
          {
            id: 'connection-gmail-1',
            usageRole: 'email',
            connector: {
              id: 'connection-gmail-1',
              type: 'gmail',
              name: 'Gmail',
              status: 'ACTIVE',
              authType: 'OAUTH',
              baseUrl: null,
              config: {
                accessToken: '',
                refreshToken: 'gmail-refresh-token',
                expiresAt: '2026-03-19T07:00:00.000Z',
                accountEmail: 'ralf@example.com',
                accountLabel: 'ralf@example.com'
              },
              lastSyncAt: null,
              createdAt: new Date('2026-03-19T07:00:00.000Z'),
              updatedAt: new Date('2026-03-19T07:00:00.000Z')
            }
          }
        ],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  });
  const gmailClient: GmailClient = {
    async listMessages(accessToken, filters) {
      assert.equal(accessToken, 'gmail-refreshed-token');
      assert.deepEqual(filters, ['label:important', 'from:boss@example.com']);

      return [
        {
          id: 'message-1',
          threadId: 'thread-1',
          subject: 'Urgent review',
          from: 'Boss <boss@example.com>',
          snippet: 'Please review this before 10.',
          receivedAt: '2026-03-26T08:15:00.000Z',
          isUnread: true,
          matchedFilters: ['label:important', 'from:boss@example.com'],
          webUrl: 'https://mail.google.com/mail/u/0/#inbox/message-1'
        },
        {
          id: 'message-2',
          threadId: 'thread-2',
          subject: 'Travel receipt',
          from: 'Travel Desk <travel@example.com>',
          snippet: 'Receipt attached.',
          receivedAt: '2026-03-26T06:00:00.000Z',
          isUnread: false,
          matchedFilters: ['label:important'],
          webUrl: 'https://mail.google.com/mail/u/0/#inbox/message-2'
        }
      ];
    }
  };
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    unusedWeatherClient(),
    unusedTodoistClient(),
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    gmailClient,
    {
      async refreshAccessToken(refreshToken) {
        assert.equal(refreshToken, 'gmail-refresh-token');

        return {
          accessToken: 'gmail-refreshed-token',
          expiresAt: '2026-03-27T12:00:00.000Z',
          scope: 'https://www.googleapis.com/auth/gmail.readonly',
          tokenType: 'Bearer'
        };
      }
    },
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer()
  );

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.generationStatus, 'READY');
  assert.equal(snapshot && snapshot.widgets[0].widgetType, 'email');
  assert.deepEqual(snapshot && snapshot.widgets[0].content, {
    provider: 'gmail',
    connectionLabel: 'Gmail',
    filters: ['label:important', 'from:boss@example.com'],
    messages: [
      {
        id: 'message-1',
        threadId: 'thread-1',
        subject: 'Urgent review',
        from: 'Boss <boss@example.com>',
        snippet: 'Please review this before 10.',
        receivedAt: '2026-03-26T08:15:00.000Z',
        isUnread: true,
        matchedFilters: ['label:important', 'from:boss@example.com'],
        url: 'https://mail.google.com/mail/u/0/#inbox/message-1'
      },
      {
        id: 'message-2',
        threadId: 'thread-2',
        subject: 'Travel receipt',
        from: 'Travel Desk <travel@example.com>',
        snippet: 'Receipt attached.',
        receivedAt: '2026-03-26T06:00:00.000Z',
        isUnread: false,
        matchedFilters: ['label:important'],
        url: 'https://mail.google.com/mail/u/0/#inbox/message-2'
      }
    ],
    emptyMessage: ''
  });
});

test('SnapshotService skips stale widget generation messages', async function () {
  const repository = new InMemorySnapshotRepository({
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      createWeatherWidget({
        version: 3,
        configHash: 'current-hash'
      })
    ]
  });
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    unusedWeatherClient(),
    unusedTodoistClient(),
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer()
  );

  const result = await service.generateForWidget({
    schemaVersion: 1,
    jobId: 'job-1',
    idempotencyKey: 'widget-1:2026-03-19:stale-hash',
    widgetId: 'widget-1',
    dashboardId: 'dash-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    widgetConfigVersion: 2,
    widgetConfigHash: 'stale-hash',
    snapshotDate: '2026-03-19',
    snapshotPeriod: 'day',
    triggerSource: 'config_updated',
    bypassDuplicateCheck: false,
    correlationId: null,
    causationId: null,
    requestedAt: '2026-03-19T08:00:00.000Z'
  });

  assert.deepEqual(result, {
    status: 'skipped',
    reason: 'stale_message'
  });
  assert.equal(repository.lastWidgetUpsertInput, null);
});

test('SnapshotService returns the latest persisted dashboard snapshot without regenerating', async function () {
  const repository = new InMemorySnapshotRepository(null);
  repository.persistedSnapshot = {
    id: 'snapshot-1',
    dashboardId: 'dash-1',
    userId: 'user-1',
    snapshotDate: '2026-03-20',
    generationStatus: 'READY',
    summary: {
      headline: 'Persisted snapshot'
    },
    generatedAt: new Date('2026-03-20T10:00:00.000Z'),
    widgets: []
  };
  const service = new SnapshotService(
    repository,
    unusedRssFeedRepository(),
    unusedWeatherClient(),
    unusedTodoistClient(),
    unusedGoogleCalendarClient(),
    unusedGoogleCalendarOAuthClient(),
    unusedGmailClient(),
    unusedGmailOAuthClient(),
    unusedRssFeedClient(),
    unusedOpenAiNewsSummarizer()
  );

  const snapshot = await service.getPersistedLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    timezone: 'Europe/Paris'
  });

  assert.deepEqual(snapshot, {
    id: 'snapshot-1',
    dashboardId: 'dash-1',
    snapshotDate: '2026-03-20',
    generationStatus: 'READY',
    summary: {
      headline: 'Persisted snapshot'
    },
    generatedAt: '2026-03-20T10:00:00.000Z',
    widgets: []
  });
  assert.equal(repository.lastUpsertInput, null);
});

class InMemorySnapshotRepository implements SnapshotRepository {
  public lastUpsertInput: UpsertDashboardSnapshotInput | null = null;
  public lastWidgetUpsertInput: UpsertWidgetSnapshotInput | null = null;
  public persistedSnapshot: DashboardSnapshotRecord | null = null;
  public newsArticleSelectionsByDate: Record<string, PersistedNewsArticleRecord[]> = {};

  constructor(private readonly dashboard: SnapshotDashboardRecord | null) {}

  async findDashboardWithWidgets(dashboardId: string, ownerUserId: string): Promise<SnapshotDashboardRecord | null> {
    if (!this.dashboard || this.dashboard.id !== dashboardId || this.dashboard.ownerUserId !== ownerUserId) {
      return null;
    }

    return this.dashboard;
  }

  async upsertDashboardSnapshot(input: UpsertDashboardSnapshotInput): Promise<DashboardSnapshotRecord> {
    this.lastUpsertInput = input;

    return {
      id: 'snapshot-1',
      dashboardId: input.dashboardId,
      userId: input.userId,
      snapshotDate: input.snapshotDate.toISOString().slice(0, 10),
      generationStatus: input.generationStatus,
      summary: input.summary,
      generatedAt: new Date('2026-03-19T08:00:00.000Z'),
      widgets: input.widgets
    };
  }

  async findLatestDashboardSnapshot() {
    return this.persistedSnapshot;
  }

  async findWidgetForSnapshotGeneration(widgetId: string) {
    return this.dashboard?.widgets.find(function findWidget(widget) {
      return widget.id === widgetId;
    }) || null;
  }

  async listWidgetsForScheduledRefresh() {
    return this.dashboard?.widgets || [];
  }

  async claimSnapshotJob(): Promise<ClaimSnapshotJobResult> {
    return {
      status: 'claimed',
      jobId: 'job-claim-1',
      attemptCount: 1
    };
  }

  async completeSnapshotJob() {}

  async setWidgetGenerating() {}

  async skipSnapshotJob() {}

  async failSnapshotJob() {}

  async upsertWidgetSnapshot(input: UpsertWidgetSnapshotInput): Promise<void> {
    this.lastWidgetUpsertInput = input;
  }

  async listNewsArticleSelections(_widgetId: string, snapshotDate: string): Promise<PersistedNewsArticleRecord[]> {
    return this.newsArticleSelectionsByDate[snapshotDate] || [];
  }

  async listPriorNewsArticleKeys(_widgetId: string, snapshotDate: string): Promise<string[]> {
    return Object.keys(this.newsArticleSelectionsByDate).filter(function filterDate(dateKey) {
      return dateKey < snapshotDate;
    }).flatMap(function mapDate(dateKey) {
      return (this.newsArticleSelectionsByDate[dateKey] || []).map(function mapItem(item) {
        return item.articleKey;
      });
    }, this);
  }

  async replaceNewsArticleSelections(
    _widget: SnapshotDashboardRecord['widgets'][number],
    snapshotDate: string,
    items: PersistedNewsArticleRecord[]
  ): Promise<void> {
    this.newsArticleSelectionsByDate[snapshotDate] = items.slice();
  }
}

function unusedWeatherClient(): WeatherClient {
  return {
    async getSnapshot() {
      throw new Error('not used');
    }
  };
}

function unusedTodoistClient(): TodoistTaskClient {
  return {
    async listTasks() {
      throw new Error('not used');
    }
  };
}

function unusedGoogleCalendarClient(): GoogleCalendarClient {
  return {
    async listEvents() {
      throw new Error('not used');
    }
  };
}

function unusedGoogleCalendarOAuthClient(): Pick<GoogleCalendarOAuthClient, 'refreshAccessToken'> {
  return {
    async refreshAccessToken() {
      throw new Error('not used');
    }
  };
}

function unusedGmailClient(): GmailClient {
  return {
    async listMessages() {
      throw new Error('not used');
    }
  };
}

function unusedGmailOAuthClient(): Pick<GmailOAuthClient, 'refreshAccessToken'> {
  return {
    async refreshAccessToken() {
      throw new Error('not used');
    }
  };
}

function unusedRssFeedRepository(): Pick<RssFeedRepository, 'listCategories'> {
  return {
    async listCategories() {
      return [];
    }
  };
}

function newsCategoryRepository(): Pick<RssFeedRepository, 'listCategories'> {
  return {
    async listCategories() {
      return [
        {
          id: 'category-1',
          tenantId: 'tenant-1',
          name: 'Technology',
          description: 'AI and software',
          sortOrder: 1,
          feeds: [
            {
              id: 'feed-1',
              categoryId: 'category-1',
              name: 'Ars Technica',
              url: 'https://example.com/rss.xml',
              createdAt: new Date('2026-03-19T07:00:00.000Z'),
              updatedAt: new Date('2026-03-19T07:00:00.000Z')
            }
          ],
          createdAt: new Date('2026-03-19T07:00:00.000Z'),
          updatedAt: new Date('2026-03-19T07:00:00.000Z')
        }
      ];
    }
  };
}

function createNewsDashboardRecord(): SnapshotDashboardRecord {
  return {
    id: 'dash-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    name: 'Morning Focus',
    description: 'Seed dashboard',
    widgets: [
      {
        id: 'widget-news',
        tenantId: 'tenant-1',
        dashboardId: 'dash-1',
        ownerUserId: 'user-1',
        ownerPreferredLanguage: 'fr-FR',
        type: 'news',
        title: 'News Briefing',
        x: 0,
        y: 0,
        width: 420,
        height: 420,
        minWidth: 360,
        minHeight: 320,
        isVisible: true,
        sortOrder: 1,
        refreshMode: 'SNAPSHOT',
        version: 1,
        config: {
          connectionId: 'connection-openai',
          connectionName: 'OpenAI',
          provider: 'openai'
        },
        configHash: 'hash-news',
        data: {},
        connections: [
          {
            id: 'connection-openai',
            usageRole: 'llm',
            connector: {
              id: 'connection-openai',
              type: 'openai',
              name: 'OpenAI',
              status: 'ACTIVE',
              authType: 'API_KEY',
              baseUrl: 'https://api.openai.com',
              config: {
                apiKey: 'openai-secret',
                model: 'gpt-5-mini',
                baseUrl: 'https://api.openai.com'
              },
              lastSyncAt: null,
              createdAt: new Date('2026-03-19T07:00:00.000Z'),
              updatedAt: new Date('2026-03-19T07:00:00.000Z')
            }
          }
        ],
        createdAt: new Date('2026-03-19T07:00:00.000Z'),
        updatedAt: new Date('2026-03-19T07:00:00.000Z')
      }
    ]
  };
}

function unusedRssFeedClient(): Pick<RssFeedClient, 'fetchFeed'> {
  return {
    async fetchFeed() {
      throw new Error('not used');
    }
  };
}

function unusedOpenAiNewsSummarizer(): Pick<OpenAiNewsSummarizer, 'summarize'> {
  return {
    async summarize() {
      throw new Error('not used');
    }
  };
}

function configuredTenantAiConfigurationService() {
  return {
    async getRequiredOpenAiConfiguration() {
      return {
        apiKey: 'tenant-openai-secret',
        model: 'gpt-5-mini'
      };
    }
  };
}

function unusedXkcdClient(): Pick<XkcdClient, 'getLatestComic'> {
  return {
    async getLatestComic() {
      throw new Error('not used');
    }
  };
}

function createWeatherWidget(overrides: Record<string, unknown> = {}) {
  return {
    id: 'widget-1',
    tenantId: 'tenant-1',
    dashboardId: 'dash-1',
    ownerUserId: 'user-1',
    type: 'weather',
    title: 'Weather Outlook',
    x: 0,
    y: 0,
    width: 320,
    height: 360,
    minWidth: 320,
    minHeight: 360,
    isVisible: true,
    sortOrder: 1,
    refreshMode: 'SNAPSHOT',
    version: 1,
    config: {
      location: {
        latitude: 47.75205,
        longitude: 7.32866,
        timezone: 'Europe/Paris',
        displayName: 'Mulhouse, FR'
      }
    },
    configHash: 'hash-weather',
    data: {},
    connections: [],
    createdAt: new Date('2026-03-19T07:00:00.000Z'),
    updatedAt: new Date('2026-03-19T07:00:00.000Z'),
    ...overrides
  };
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
