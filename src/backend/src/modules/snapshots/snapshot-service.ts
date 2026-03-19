import type { DefaultUserContext } from '../default-user/default-user-service.js';
import type { DashboardWidgetRecord } from '../widgets/widget-types.js';
import type { WeatherClient } from './open-meteo-weather-client.js';
import type { SnapshotRepository } from './snapshot-repository.js';
import type {
  DashboardSnapshotRecord,
  DashboardSnapshotResponse,
  DashboardSnapshotWidgetRecord
} from './snapshot-types.js';

export class SnapshotService {
  constructor(
    private readonly repository: SnapshotRepository,
    private readonly weatherClient: WeatherClient
  ) {}

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
