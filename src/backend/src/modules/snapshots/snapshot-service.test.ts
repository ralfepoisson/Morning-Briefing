import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotService } from './snapshot-service.js';
import type { SnapshotRepository, SnapshotDashboardRecord, UpsertDashboardSnapshotInput } from './snapshot-repository.js';
import type { DashboardSnapshotRecord, WeatherSnapshotData } from './snapshot-types.js';
import type { WeatherClient } from './open-meteo-weather-client.js';

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
        config: {
          location: {
            latitude: 47.75205,
            longitude: 7.32866,
            timezone: 'Europe/Paris',
            displayName: 'Mulhouse, FR'
          }
        },
        data: {},
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
  const service = new SnapshotService(repository, weatherClient);

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe'
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
        config: {},
        data: {},
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
  const service = new SnapshotService(repository, weatherClient);

  const snapshot = await service.getLatestForDashboard('dash-1', {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe'
  });

  assert.ok(snapshot);
  assert.equal(snapshot && snapshot.generationStatus, 'FAILED');
  assert.equal(snapshot && snapshot.widgets[0].status, 'FAILED');
  assert.equal(snapshot && snapshot.widgets[0].errorMessage, 'Weather widget is missing a configured city.');
});

class InMemorySnapshotRepository implements SnapshotRepository {
  public lastUpsertInput: UpsertDashboardSnapshotInput | null = null;

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
}
