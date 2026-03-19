import test from 'node:test';
import assert from 'node:assert/strict';
import { WidgetService } from './widget-service.js';
import type { WidgetRepository } from './widget-repository.js';
import type {
  CreateDashboardWidgetInput,
  DashboardWidgetRecord,
  UpdateDashboardWidgetInput
} from './widget-types.js';

test('WidgetService lists widgets for a dashboard', async function () {
  const repository = new InMemoryWidgetRepository([
    createWidgetRecord({
      id: 'widget-1',
      dashboardId: 'dash-1',
      ownerUserId: 'user-1',
      type: 'weather'
    })
  ]);
  const service = new WidgetService(repository);

  const widgets = await service.listForDashboard('dash-1', 'user-1');

  assert.equal(widgets.length, 1);
  assert.equal(widgets[0].type, 'weather');
  assert.equal(widgets[0].dashboardId, 'dash-1');
});

test('WidgetService creates a widget', async function () {
  const repository = new InMemoryWidgetRepository([]);
  const service = new WidgetService(repository);

  const widget = await service.create({
    dashboardId: 'dash-1',
    ownerUserId: 'user-1',
    type: 'calendar'
  });

  assert.equal(widget.type, 'calendar');
  assert.equal(widget.dashboardId, 'dash-1');
  assert.equal(widget.x, 36);
});

test('WidgetService updates widget layout', async function () {
  const repository = new InMemoryWidgetRepository([
    createWidgetRecord({
      id: 'widget-1',
      dashboardId: 'dash-1',
      ownerUserId: 'user-1',
      config: {
        location: {
          displayName: 'Paris, Ile-de-France, FR'
        }
      }
    })
  ]);
  const service = new WidgetService(repository);

  const widget = await service.update({
    dashboardId: 'dash-1',
    widgetId: 'widget-1',
    ownerUserId: 'user-1',
    x: 120,
    y: 160,
    width: 360,
    height: 420,
    config: {
      location: {
        displayName: 'London, England, GB'
      }
    }
  });

  assert.equal(widget && widget.x, 120);
  assert.equal(widget && widget.y, 160);
  assert.equal(widget && widget.height, 420);
  assert.deepEqual(widget && widget.config, {
    location: {
      displayName: 'London, England, GB'
    }
  });
});

class InMemoryWidgetRepository implements WidgetRepository {
  constructor(private readonly items: DashboardWidgetRecord[]) {}

  async listForDashboard(dashboardId: string, ownerUserId: string): Promise<DashboardWidgetRecord[]> {
    return this.items.filter(function (item) {
      return item.dashboardId === dashboardId && item.ownerUserId === ownerUserId;
    });
  }

  async create(input: CreateDashboardWidgetInput): Promise<DashboardWidgetRecord> {
    const widget = createWidgetRecord({
      id: `widget-${this.items.length + 1}`,
      dashboardId: input.dashboardId,
      ownerUserId: input.ownerUserId,
      type: input.type
    });

    this.items.push(widget);
    return widget;
  }

  async update(input: UpdateDashboardWidgetInput): Promise<DashboardWidgetRecord | null> {
    const widget = this.items.find(function (item) {
      return item.id === input.widgetId && item.dashboardId === input.dashboardId && item.ownerUserId === input.ownerUserId;
    });

    if (!widget) {
      return null;
    }

    widget.x = input.x;
    widget.y = input.y;
    widget.width = input.width;
    widget.height = input.height;
    widget.config = input.config || widget.config;
    widget.updatedAt = new Date();
    return widget;
  }
}

function createWidgetRecord(overrides: Partial<DashboardWidgetRecord>): DashboardWidgetRecord {
  return {
    id: overrides.id || 'widget-1',
    dashboardId: overrides.dashboardId || 'dash-1',
    ownerUserId: overrides.ownerUserId || 'user-1',
    type: overrides.type || 'weather',
    title: overrides.title || 'Widget',
    x: overrides.x || 36,
    y: overrides.y || 36,
    width: overrides.width || 320,
    height: overrides.height || 360,
    minWidth: overrides.minWidth || 320,
    minHeight: overrides.minHeight || 260,
    isVisible: overrides.isVisible !== false,
    sortOrder: overrides.sortOrder || 1,
    config: overrides.config || {},
    data: overrides.data || {},
    createdAt: overrides.createdAt || new Date('2026-03-19T07:00:00.000Z'),
    updatedAt: overrides.updatedAt || new Date('2026-03-19T07:00:00.000Z')
  };
}
