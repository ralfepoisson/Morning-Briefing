import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerDashboardRoutes } from './dashboard-routes.js';
import type { DashboardResponse } from './dashboard-types.js';

test('GET /api/v1/me returns the default user profile', async function () {
  const app = Fastify();

  await registerDashboardRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    dashboardService: {
      async listForOwner() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      },
      async archive() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      id: 'user-1',
      displayName: 'Ralfe'
    });
  } finally {
    await app.close();
  }
});

test('GET /api/v1/dashboards returns dashboards for the default user', async function () {
  const app = Fastify();
  const expectedDashboards = [
    createDashboardResponse({
      id: 'dash-1',
      name: 'Morning Focus'
    })
  ];

  await registerDashboardRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    dashboardService: {
      async listForOwner(ownerUserId: string) {
        assert.equal(ownerUserId, 'user-1');
        return expectedDashboards;
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      },
      async archive() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboards'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      items: expectedDashboards
    });
  } finally {
    await app.close();
  }
});

test('PATCH /api/v1/dashboards/:dashboardId updates a dashboard', async function () {
  const app = Fastify();

  await registerDashboardRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    dashboardService: {
      async listForOwner() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update(input) {
        assert.equal(input.dashboardId, 'dash-1');
        assert.equal(input.ownerUserId, 'user-1');
        assert.equal(input.name, 'Travel Briefing');
        assert.equal(input.description, 'Flights and weather');

        return createDashboardResponse({
          id: 'dash-1',
          name: 'Travel Briefing',
          description: 'Flights and weather'
        });
      },
      async archive() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/dashboards/dash-1',
      payload: {
        name: 'Travel Briefing',
        description: 'Flights and weather'
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), createDashboardResponse({
      id: 'dash-1',
      name: 'Travel Briefing',
      description: 'Flights and weather'
    }));
  } finally {
    await app.close();
  }
});

test('POST /api/v1/dashboards creates a dashboard', async function () {
  const app = Fastify();

  await registerDashboardRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    dashboardService: {
      async listForOwner() {
        throw new Error('not used');
      },
      async create(input) {
        assert.equal(input.ownerUserId, 'user-1');
        assert.equal(input.name, 'Weekend Reset');
        assert.equal(input.description, 'A slower dashboard');
        assert.equal(input.theme, 'aurora');

        return createDashboardResponse({
          id: 'dash-2',
          name: 'Weekend Reset',
          description: 'A slower dashboard'
        });
      },
      async update() {
        throw new Error('not used');
      },
      async archive() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboards',
      payload: {
        name: 'Weekend Reset',
        description: 'A slower dashboard',
        theme: 'aurora'
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().name, 'Weekend Reset');
  } finally {
    await app.close();
  }
});

test('POST /api/v1/dashboards rejects blank names', async function () {
  const app = Fastify();

  await registerDashboardRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    dashboardService: {
      async listForOwner() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      },
      async archive() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboards',
      payload: {
        name: '   '
      }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      message: 'Dashboard name is required.'
    });
  } finally {
    await app.close();
  }
});

test('DELETE /api/v1/dashboards/:dashboardId archives a dashboard', async function () {
  const app = Fastify();

  await registerDashboardRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    dashboardService: {
      async listForOwner() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      },
      async archive(input) {
        assert.equal(input.dashboardId, 'dash-1');
        assert.equal(input.ownerUserId, 'user-1');
        return true;
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/dashboards/dash-1'
    });

    assert.equal(response.statusCode, 204);
  } finally {
    await app.close();
  }
});

test('DELETE /api/v1/dashboards/:dashboardId returns 404 when dashboard is missing', async function () {
  const app = Fastify();

  await registerDashboardRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    dashboardService: {
      async listForOwner() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      },
      async archive() {
        return false;
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/dashboards/dash-missing'
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      message: 'Dashboard not found.'
    });
  } finally {
    await app.close();
  }
});

function createDashboardResponse(overrides: Partial<DashboardResponse>): DashboardResponse {
  return {
    id: overrides.id || 'dash-1',
    name: overrides.name || 'Morning Focus',
    description: overrides.description || 'Seed dashboard',
    theme: overrides.theme || 'aurora',
    createdAt: overrides.createdAt || '2026-03-19T07:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-03-19T07:00:00.000Z'
  };
}
