import type { GoogleCalendarOAuthClient } from '../connections/google-calendar-oauth-client.js';
import type { DefaultUserContext } from '../default-user/default-user-service.js';
import type { DashboardWidgetRecord } from '../widgets/widget-types.js';
import type { GoogleCalendarClient, GoogleCalendarEvent } from './google-calendar-client.js';
import type { WeatherClient } from './open-meteo-weather-client.js';
import type { GenerateWidgetSnapshotRequested } from './snapshot-job-types.js';
import type { TodoistTask, TodoistTaskClient } from './todoist-task-client.js';
import type { SnapshotRepository } from './snapshot-repository.js';
import type {
  DashboardSnapshotRecord,
  DashboardSnapshotResponse,
  DashboardSnapshotWidgetRecord
} from './snapshot-types.js';

export class SnapshotService {
  constructor(
    private readonly repository: SnapshotRepository,
    private readonly weatherClient: WeatherClient,
    private readonly todoistTaskClient: TodoistTaskClient,
    private readonly googleCalendarClient: GoogleCalendarClient,
    private readonly googleCalendarOAuthClient: Pick<GoogleCalendarOAuthClient, 'refreshAccessToken'>
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

    await this.repository.upsertWidgetSnapshot({
      widget,
      snapshotDate: message.snapshotDate,
      widgetSnapshot
    });

    return {
      status: 'generated'
    };
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

    return toResponse(snapshot);
  }

  private async buildWidgetSnapshot(widget: DashboardWidgetRecord, generatedAt: Date): Promise<DashboardSnapshotWidgetRecord> {
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
        content: buildTaskSnapshotContent(tasks, generatedAt, connector.connector.name),
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
  if (typeof config.accessToken === 'string' && config.accessToken.trim()) {
    return config.accessToken.trim();
  }

  return '';
}

function getGoogleCalendarRefreshToken(config: Record<string, unknown>): string {
  if (typeof config.refreshToken === 'string' && config.refreshToken.trim()) {
    return config.refreshToken.trim();
  }

  return '';
}

function isTokenExpired(config: Record<string, unknown>): boolean {
  if (typeof config.expiresAt !== 'string' || !config.expiresAt.trim()) {
    return true;
  }

  return Date.parse(config.expiresAt) <= Date.now() + 60_000;
}

function buildTaskSnapshotContent(tasks: TodoistTask[], generatedAt: Date, connectionName: string): Record<string, unknown> {
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

function countCalendarAppointments(appointments: unknown): number {
  if (!Array.isArray(appointments)) {
    return 0;
  }

  return appointments.length;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
