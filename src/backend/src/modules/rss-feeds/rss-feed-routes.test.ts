import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerRssFeedRoutes } from './rss-feed-routes.js';

test('GET /api/v1/rss-feeds returns feed categories', async function () {
  const app = Fastify();

  await registerRssFeedRoutes(app, {
    rssFeedService: {
      async listForTenant() {
        return [
          {
            id: 'category-1',
            name: 'Technology',
            description: 'AI and software',
            sortOrder: 1,
            feeds: [
              {
                id: 'feed-1',
                name: 'Ars Technica',
                url: 'https://example.com/rss.xml',
                createdAt: '2026-03-20T10:00:00.000Z',
                updatedAt: '2026-03-20T10:00:00.000Z'
              }
            ],
            createdAt: '2026-03-20T10:00:00.000Z',
            updatedAt: '2026-03-20T10:00:00.000Z'
          }
        ];
      },
      async createCategory() {
        throw new Error('not used');
      },
      async updateCategory() {
        throw new Error('not used');
      },
      async deleteCategory() {
        throw new Error('not used');
      },
      async addFeed() {
        throw new Error('not used');
      },
      async removeFeed() {
        throw new Error('not used');
      }
    },
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    }
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/rss-feeds'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().items[0].feeds.length, 1);

  await app.close();
});
