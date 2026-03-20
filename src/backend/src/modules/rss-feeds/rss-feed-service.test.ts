import test from 'node:test';
import assert from 'node:assert/strict';
import { RssFeedService } from './rss-feed-service.js';

test('RssFeedService rejects duplicate category names', async function () {
  const service = new RssFeedService({
    async listCategories() {
      return [];
    },
    async findCategoryById() {
      return null;
    },
    async findCategoryByName() {
      return {
        id: 'category-1',
        tenantId: 'tenant-1',
        name: 'Technology',
        description: '',
        sortOrder: 1,
        feeds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    async createCategory() {
      throw new Error('not used');
    },
    async updateCategory() {
      throw new Error('not used');
    },
    async deleteCategory() {
      return true;
    },
    async addFeed() {
      return null;
    },
    async removeFeed() {
      return true;
    }
  });

  await assert.rejects(function shouldReject() {
    return service.createCategory({
      tenantId: 'tenant-1',
      name: 'Technology',
      description: ''
    });
  }, /already exists/);
});
