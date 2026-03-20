import type { GoogleCalendarOAuthClient } from '../connections/google-calendar-oauth-client.js';
import type { GoogleCalendarClient } from './google-calendar-client.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotService } from './snapshot-service.js';
import type {
  SnapshotRepository,
  SnapshotDashboardRecord,
  UpsertDashboardSnapshotInput,
  UpsertWidgetSnapshotInput,
  ClaimSnapshotJobResult
} from './snapshot-repository.js';
import type { DashboardSnapshotRecord, WeatherSnapshotData } from './snapshot-types.js';
import type { WeatherClient } from './open-meteo-weather-client.js';
import type { TodoistTaskClient } from './todoist-task-client.js';
import type { GenerateWidgetSnapshotRequested } from './snapshot-job-types.js';

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
  const service = new SnapshotService(repository, weatherClient, todoistTaskClient, unusedGoogleCalendarClient(), unusedGoogleCalendarOAuthClient());

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
  const service = new SnapshotService(repository, weatherClient, todoistTaskClient, unusedGoogleCalendarClient(), unusedGoogleCalendarOAuthClient());

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
  const service = new SnapshotService(repository, weatherClient, todoistTaskClient, unusedGoogleCalendarClient(), unusedGoogleCalendarOAuthClient());

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
  const service = new SnapshotService(repository, weatherClient, todoistTaskClient, googleCalendarClient, googleCalendarOAuthClient);

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
  const service = new SnapshotService(repository, unusedWeatherClient(), unusedTodoistClient(), unusedGoogleCalendarClient(), unusedGoogleCalendarOAuthClient());

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

class InMemorySnapshotRepository implements SnapshotRepository {
  public lastUpsertInput: UpsertDashboardSnapshotInput | null = null;
  public lastWidgetUpsertInput: UpsertWidgetSnapshotInput | null = null;

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

  async skipSnapshotJob() {}

  async failSnapshotJob() {}

  async upsertWidgetSnapshot(input: UpsertWidgetSnapshotInput): Promise<void> {
    this.lastWidgetUpsertInput = input;
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
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
