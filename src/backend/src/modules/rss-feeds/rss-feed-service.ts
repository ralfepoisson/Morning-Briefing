import type { RssFeedRepository } from './rss-feed-repository.js';
import type { RssFeedCategoryResponse, RssFeedResponse } from './rss-feed-types.js';

export class RssFeedService {
  constructor(private readonly repository: RssFeedRepository) {}

  async listForTenant(tenantId: string): Promise<RssFeedCategoryResponse[]> {
    const categories = await this.repository.listCategories(tenantId);
    return categories.map(toCategoryResponse);
  }

  async createCategory(input: {
    tenantId: string;
    name: string;
    description?: string;
  }): Promise<RssFeedCategoryResponse> {
    const name = sanitizeText(input.name);

    if (!name) {
      throw new Error('Category name is required.');
    }

    const existing = await this.repository.findCategoryByName(input.tenantId, name);

    if (existing) {
      throw new Error('A category with that name already exists.');
    }

    const category = await this.repository.createCategory({
      tenantId: input.tenantId,
      name,
      description: sanitizeText(input.description)
    });

    return toCategoryResponse(category);
  }

  async updateCategory(input: {
    tenantId: string;
    categoryId: string;
    name: string;
    description?: string;
  }): Promise<RssFeedCategoryResponse> {
    const name = sanitizeText(input.name);

    if (!name) {
      throw new Error('Category name is required.');
    }

    const existing = await this.repository.findCategoryByName(input.tenantId, name);

    if (existing && existing.id !== input.categoryId) {
      throw new Error('A category with that name already exists.');
    }

    const category = await this.repository.updateCategory({
      tenantId: input.tenantId,
      categoryId: input.categoryId,
      name,
      description: sanitizeText(input.description)
    });

    if (!category) {
      throw new Error('Category not found.');
    }

    return toCategoryResponse(category);
  }

  async deleteCategory(tenantId: string, categoryId: string): Promise<void> {
    const deleted = await this.repository.deleteCategory(tenantId, categoryId);

    if (!deleted) {
      throw new Error('Category not found.');
    }
  }

  async addFeed(input: {
    tenantId: string;
    categoryId: string;
    name: string;
    url: string;
  }): Promise<RssFeedCategoryResponse> {
    const name = sanitizeText(input.name);
    const url = sanitizeUrl(input.url);

    if (!name) {
      throw new Error('Feed name is required.');
    }

    if (!url) {
      throw new Error('A valid feed URL is required.');
    }

    const category = await this.repository.findCategoryById(input.tenantId, input.categoryId);

    if (!category) {
      throw new Error('Category not found.');
    }

    if (category.feeds.some(function hasMatchingUrl(feed) {
      return feed.url.toLowerCase() === url.toLowerCase();
    })) {
      throw new Error('That feed URL already exists in this category.');
    }

    await this.repository.addFeed({
      tenantId: input.tenantId,
      categoryId: input.categoryId,
      name,
      url
    });

    const updatedCategory = await this.repository.findCategoryById(input.tenantId, input.categoryId);

    if (!updatedCategory) {
      throw new Error('Category not found.');
    }

    return toCategoryResponse(updatedCategory);
  }

  async removeFeed(tenantId: string, categoryId: string, feedId: string): Promise<RssFeedCategoryResponse> {
    const removed = await this.repository.removeFeed(tenantId, categoryId, feedId);

    if (!removed) {
      throw new Error('Feed not found.');
    }

    const category = await this.repository.findCategoryById(tenantId, categoryId);

    if (!category) {
      throw new Error('Category not found.');
    }

    return toCategoryResponse(category);
  }
}

function toCategoryResponse(category: {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  feeds: Array<{
    id: string;
    name: string;
    url: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}): RssFeedCategoryResponse {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
    feeds: category.feeds.map(toFeedResponse),
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString()
  };
}

function toFeedResponse(feed: {
  id: string;
  name: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}): RssFeedResponse {
  return {
    id: feed.id,
    name: feed.name,
    url: feed.url,
    createdAt: feed.createdAt.toISOString(),
    updatedAt: feed.updatedAt.toISOString()
  };
}

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeUrl(value: unknown): string {
  const text = sanitizeText(value);

  if (!text) {
    return '';
  }

  try {
    const url = new URL(text);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }

    return url.toString();
  } catch {
    return '';
  }
}
