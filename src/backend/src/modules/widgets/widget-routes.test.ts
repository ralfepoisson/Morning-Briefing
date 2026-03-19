import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerWidgetRoutes } from './widget-routes.js';
import type { DashboardWidgetResponse } from './widget-types.js';

test('GET /api/v1/dashboards/:dashboardId/widgets returns widget instances', async function () {
  const app = Fastify();
  const expectedWidgets = [
    createWidgetResponse({
      id: 'widget-1',
      dashboardId: 'dash-1',
      type: 'weather'
    })
  ];

  await registerWidgetRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe'
        };
      }
    },
    widgetService: {
      async listForDashboard(dashboardId: string, ownerUserId: string) {
        assert.equal(dashboardId, 'dash-1');
        assert.equal(ownerUserId, 'user-1');
        return expectedWidgets;
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboards/dash-1/widgets'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      items: expectedWidgets
    });
  } finally {
    await app.close();
  }
});

test('POST /api/v1/dashboards/:dashboardId/widgets creates a widget', async function () {
  const app = Fastify();

  await registerWidgetRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe'
        };
      }
    },
    widgetService: {
      async listForDashboard() {
        throw new Error('not used');
      },
      async create(input) {
        assert.equal(input.dashboardId, 'dash-1');
        assert.equal(input.ownerUserId, 'user-1');
        assert.equal(input.type, 'calendar');

        return createWidgetResponse({
          id: 'widget-2',
          dashboardId: 'dash-1',
          type: 'calendar',
          title: 'Today on Calendar'
        });
      },
      async update() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboards/dash-1/widgets',
      payload: {
        type: 'calendar'
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().type, 'calendar');
  } finally {
    await app.close();
  }
});

test('POST /api/v1/dashboards/:dashboardId/widgets rejects blank widget type', async function () {
  const app = Fastify();

  await registerWidgetRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe'
        };
      }
    },
    widgetService: {
      async listForDashboard() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboards/dash-1/widgets',
      payload: {
        type: '   '
      }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      message: 'Widget type is required.'
    });
  } finally {
    await app.close();
  }
});

test('PATCH /api/v1/dashboards/:dashboardId/widgets/:widgetId updates widget layout', async function () {
  const app = Fastify();

  await registerWidgetRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe'
        };
      }
    },
    widgetService: {
      async listForDashboard() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update(input) {
        assert.equal(input.dashboardId, 'dash-1');
        assert.equal(input.widgetId, 'widget-1');
        assert.equal(input.x, 120);
        assert.equal(input.y, 160);
        assert.deepEqual(input.config, {
          location: {
            displayName: 'Paris, Ile-de-France, FR'
          }
        });

        return createWidgetResponse({
          id: 'widget-1',
          dashboardId: 'dash-1',
          type: 'weather',
          x: 120,
          y: 160,
          width: 320,
          height: 360,
          config: {
            location: {
              displayName: 'Paris, Ile-de-France, FR'
            }
          }
        });
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/dashboards/dash-1/widgets/widget-1',
      payload: {
        x: 120,
        y: 160,
        width: 320,
        height: 360,
        config: {
          location: {
            displayName: 'Paris, Ile-de-France, FR'
          }
        }
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().x, 120);
  } finally {
    await app.close();
  }
});

function createWidgetResponse(overrides: Partial<DashboardWidgetResponse>): DashboardWidgetResponse {
  return {
    id: overrides.id || 'widget-1',
    dashboardId: overrides.dashboardId || 'dash-1',
    type: overrides.type || 'weather',
    title: overrides.title || 'Weather Outlook',
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
    createdAt: overrides.createdAt || '2026-03-19T07:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-03-19T07:00:00.000Z'
  };
}
