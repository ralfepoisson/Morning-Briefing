import { describe, expect, it } from 'vitest';
import { DashboardStore, type Widget } from './dashboard-store.ts';

describe('DashboardStore', function () {
  it('preserves unsaved layout when a widget is added', function () {
    const weather = createWidget('weather-1', 'weather');
    const store = new DashboardStore([weather]);

    store.updateLayout(weather.id, { x: 140, y: 180, width: 420, height: 310 });
    store.add(createWidget('tasks-2', 'tasks'));

    expect(store.get(weather.id)).toMatchObject({ x: 140, y: 180, width: 420, height: 310 });
  });

  it('applies snapshot content and timestamps without replacing widget configuration', function () {
    const weather = createWidget('weather-1', 'weather');
    weather.config = { location: { displayName: 'Paris' } };
    const store = new DashboardStore([weather]);

    store.applySnapshot({
      widgets: [{
        widgetId: weather.id,
        content: { temperature: '18°C' },
        generatedAt: '2026-03-28T07:45:00.000Z',
        errorMessage: null
      }]
    });

    expect(store.get(weather.id)?.config).toEqual(weather.config);
    expect(store.get(weather.id)).toMatchObject({
      data: { temperature: '18°C' },
      generatedAt: '2026-03-28T07:45:00.000Z'
    });
  });
});

function createWidget(id: string, type: string): Widget {
  return {
    id,
    dashboardId: 'dashboard-1',
    type,
    title: type,
    x: 0,
    y: 0,
    width: 360,
    height: 260,
    config: {},
    data: {}
  };
}
