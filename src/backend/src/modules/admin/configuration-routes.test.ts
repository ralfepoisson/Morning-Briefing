import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerAdminConfigurationRoutes } from './configuration-routes.js';

test('GET /api/v1/admin/configuration returns tenant AI configuration', async function () {
  const app = Fastify();

  await registerAdminConfigurationRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'admin-1',
          displayName: 'Admin',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'admin@example.com',
          isAdmin: true
        };
      }
    },
    tenantAiConfigurationService: {
      async getConfiguration(tenantId) {
        assert.equal(tenantId, 'tenant-1');

        return {
          id: 'config-1',
          tenantId: 'tenant-1',
          hasOpenAiApiKey: true,
          openAiModel: 'gpt-5-mini',
          availableOpenAiModels: ['gpt-5-mini', 'gpt-5', 'gpt-4.1-mini'],
          createdAt: '2026-03-25T20:00:00.000Z',
          updatedAt: '2026-03-25T20:10:00.000Z'
        };
      },
      async updateConfiguration() {
        throw new Error('not used');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/configuration'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      id: 'config-1',
      tenantId: 'tenant-1',
      hasOpenAiApiKey: true,
      openAiModel: 'gpt-5-mini',
      availableOpenAiModels: ['gpt-5-mini', 'gpt-5', 'gpt-4.1-mini'],
      createdAt: '2026-03-25T20:00:00.000Z',
      updatedAt: '2026-03-25T20:10:00.000Z'
    });
  } finally {
    await app.close();
  }
});

test('PATCH /api/v1/admin/configuration updates tenant AI configuration', async function () {
  const app = Fastify();

  await registerAdminConfigurationRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'admin-1',
          displayName: 'Admin',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          email: 'admin@example.com',
          isAdmin: true
        };
      }
    },
    tenantAiConfigurationService: {
      async getConfiguration() {
        throw new Error('not used');
      },
      async updateConfiguration(input) {
        assert.deepEqual(input, {
          tenantId: 'tenant-1',
          openAiApiKey: 'sk-test',
          openAiModel: 'gpt-5'
        });

        return {
          id: 'config-1',
          tenantId: 'tenant-1',
          hasOpenAiApiKey: true,
          openAiModel: 'gpt-5',
          availableOpenAiModels: ['gpt-5-mini', 'gpt-5', 'gpt-4.1-mini'],
          createdAt: '2026-03-25T20:00:00.000Z',
          updatedAt: '2026-03-25T20:20:00.000Z'
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/configuration',
      payload: {
        openAiApiKey: 'sk-test',
        openAiModel: 'gpt-5'
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().openAiModel, 'gpt-5');
    assert.equal(response.json().hasOpenAiApiKey, true);
  } finally {
    await app.close();
  }
});
