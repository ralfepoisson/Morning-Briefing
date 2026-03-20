import type { RssFeedCategoryRecord, RssFeedRecord } from './rss-feed-types.js';

export type CreateRssFeedCategoryInput = {
  tenantId: string;
  name: string;
  description: string;
};

export type UpdateRssFeedCategoryInput = {
  tenantId: string;
  categoryId: string;
  name: string;
  description: string;
};

export type CreateRssFeedInput = {
  tenantId: string;
  categoryId: string;
  name: string;
  url: string;
};

export interface RssFeedRepository {
  listCategories(tenantId: string): Promise<RssFeedCategoryRecord[]>;
  findCategoryById(tenantId: string, categoryId: string): Promise<RssFeedCategoryRecord | null>;
  findCategoryByName(tenantId: string, name: string): Promise<RssFeedCategoryRecord | null>;
  createCategory(input: CreateRssFeedCategoryInput): Promise<RssFeedCategoryRecord>;
  updateCategory(input: UpdateRssFeedCategoryInput): Promise<RssFeedCategoryRecord | null>;
  deleteCategory(tenantId: string, categoryId: string): Promise<boolean>;
  addFeed(input: CreateRssFeedInput): Promise<RssFeedRecord | null>;
  removeFeed(tenantId: string, categoryId: string, feedId: string): Promise<boolean>;
}
