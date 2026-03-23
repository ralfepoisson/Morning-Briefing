import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerUserRoutes } from './user-routes.js';

test('GET /api/v1/users/me returns the authenticated user profile', async function () {
  const app = Fastify();

  await registerUserRoutes(app, {
    prisma: {
      appUser: {} as never
    } as never,
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'ralfe@example.com',
          isAdmin: true
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        displayName: 'Ralfe',
        email: 'ralfe@example.com',
        timezone: 'Europe/Paris',
        locale: 'en-GB',
        isAdmin: true
      }
    });
  } finally {
    await app.close();
  }
});

test('GET /api/v1/admin/users lists users for the current tenant', async function () {
  const app = Fastify();

  await registerUserRoutes(app, {
    prisma: {
      appUser: {
        findMany: async function findMany() {
          return [
            {
              id: 'user-1',
              tenantId: 'tenant-1',
              displayName: 'Ralfe',
              email: 'ralfe@example.com',
              timezone: 'Europe/Paris',
              locale: 'en-GB',
              isAdmin: true,
              isActive: true,
              createdAt: new Date('2026-03-20T08:00:00.000Z'),
              updatedAt: new Date('2026-03-22T08:00:00.000Z')
            },
            {
              id: 'user-2',
              tenantId: 'tenant-1',
              displayName: 'Taylor',
              email: 'taylor@example.com',
              timezone: 'UTC',
              locale: 'en-US',
              isAdmin: false,
              isActive: true,
              createdAt: new Date('2026-03-20T09:00:00.000Z'),
              updatedAt: new Date('2026-03-22T09:00:00.000Z')
            }
          ];
        }
      }
    } as never,
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'ralfe@example.com',
          isAdmin: true
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      items: [
        {
          id: 'user-1',
          displayName: 'Ralfe',
          email: 'ralfe@example.com',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          isAdmin: true,
          isActive: true,
          isCurrentUser: true,
          createdAt: '2026-03-20T08:00:00.000Z',
          updatedAt: '2026-03-22T08:00:00.000Z'
        },
        {
          id: 'user-2',
          displayName: 'Taylor',
          email: 'taylor@example.com',
          timezone: 'UTC',
          locale: 'en-US',
          isAdmin: false,
          isActive: true,
          isCurrentUser: false,
          createdAt: '2026-03-20T09:00:00.000Z',
          updatedAt: '2026-03-22T09:00:00.000Z'
        }
      ]
    });
  } finally {
    await app.close();
  }
});

test('PATCH /api/v1/admin/users/:userId/access updates admin access', async function () {
  const app = Fastify();

  await registerUserRoutes(app, {
    prisma: {
      appUser: {
        findMany: async function findMany() {
          return [];
        },
        findFirst: async function findFirst() {
          return {
            id: 'user-2',
            tenantId: 'tenant-1',
            displayName: 'Taylor',
            email: 'taylor@example.com',
            timezone: 'UTC',
            locale: 'en-US',
            isAdmin: false,
            isActive: true,
            createdAt: new Date('2026-03-20T09:00:00.000Z'),
            updatedAt: new Date('2026-03-22T09:00:00.000Z')
          };
        },
        count: async function count() {
          return 2;
        },
        update: async function update() {
          return {
            id: 'user-2',
            tenantId: 'tenant-1',
            displayName: 'Taylor',
            email: 'taylor@example.com',
            timezone: 'UTC',
            locale: 'en-US',
            isAdmin: true,
            isActive: true,
            createdAt: new Date('2026-03-20T09:00:00.000Z'),
            updatedAt: new Date('2026-03-23T09:00:00.000Z')
          };
        }
      }
    } as never,
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'ralfe@example.com',
          isAdmin: true
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/users/user-2/access',
      payload: {
        isAdmin: true
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      user: {
        id: 'user-2',
        displayName: 'Taylor',
        email: 'taylor@example.com',
        timezone: 'UTC',
        locale: 'en-US',
        isAdmin: true,
        isActive: true,
        isCurrentUser: false,
        createdAt: '2026-03-20T09:00:00.000Z',
        updatedAt: '2026-03-23T09:00:00.000Z'
      }
    });
  } finally {
    await app.close();
  }
});

test('PATCH /api/v1/admin/users/:userId/access prevents removing the last admin', async function () {
  const app = Fastify();

  await registerUserRoutes(app, {
    prisma: {
      appUser: {
        findMany: async function findMany() {
          return [];
        },
        findFirst: async function findFirst() {
          return {
            id: 'user-1',
            tenantId: 'tenant-1',
            displayName: 'Ralfe',
            email: 'ralfe@example.com',
            timezone: 'Europe/Paris',
            locale: 'en-GB',
            isAdmin: true,
            isActive: true,
            createdAt: new Date('2026-03-20T08:00:00.000Z'),
            updatedAt: new Date('2026-03-22T08:00:00.000Z')
          };
        },
        count: async function count() {
          return 1;
        },
        update: async function update() {
          throw new Error('not expected');
        }
      }
    } as never,
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'ralfe@example.com',
          isAdmin: true
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/users/user-1/access',
      payload: {
        isAdmin: false
      }
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), {
      message: 'At least one admin must remain for this account.'
    });
  } finally {
    await app.close();
  }
});
