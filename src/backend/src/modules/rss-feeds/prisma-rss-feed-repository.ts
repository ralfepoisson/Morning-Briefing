import type { PrismaClient } from '@prisma/client';
import type {
  CreateRssFeedCategoryInput,
  CreateRssFeedInput,
  RssFeedRepository,
  UpdateRssFeedCategoryInput
} from './rss-feed-repository.js';
import type { RssFeedCategoryRecord, RssFeedRecord } from './rss-feed-types.js';

export class PrismaRssFeedRepository implements RssFeedRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listCategories(tenantId: string): Promise<RssFeedCategoryRecord[]> {
    const categories = await this.prisma.rssFeedCategory.findMany({
      where: {
        tenantId
      },
      include: {
        feeds: {
          orderBy: [
            { createdAt: 'asc' }
          ]
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return categories.map(mapCategoryRecord);
  }

  async findCategoryById(tenantId: string, categoryId: string): Promise<RssFeedCategoryRecord | null> {
    const category = await this.prisma.rssFeedCategory.findFirst({
      where: {
        id: categoryId,
        tenantId
      },
      include: {
        feeds: {
          orderBy: [
            { createdAt: 'asc' }
          ]
        }
      }
    });

    return category ? mapCategoryRecord(category) : null;
  }

  async findCategoryByName(tenantId: string, name: string): Promise<RssFeedCategoryRecord | null> {
    const category = await this.prisma.rssFeedCategory.findFirst({
      where: {
        tenantId,
        normalizedName: normalizeName(name)
      },
      include: {
        feeds: {
          orderBy: [
            { createdAt: 'asc' }
          ]
        }
      }
    });

    return category ? mapCategoryRecord(category) : null;
  }

  async createCategory(input: CreateRssFeedCategoryInput): Promise<RssFeedCategoryRecord> {
    const lastCategory = await this.prisma.rssFeedCategory.findFirst({
      where: {
        tenantId: input.tenantId
      },
      orderBy: {
        sortOrder: 'desc'
      }
    });

    const category = await this.prisma.rssFeedCategory.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        normalizedName: normalizeName(input.name),
        description: input.description,
        sortOrder: lastCategory ? lastCategory.sortOrder + 1 : 1
      },
      include: {
        feeds: true
      }
    });

    return mapCategoryRecord(category);
  }

  async updateCategory(input: UpdateRssFeedCategoryInput): Promise<RssFeedCategoryRecord | null> {
    const category = await this.prisma.rssFeedCategory.findFirst({
      where: {
        id: input.categoryId,
        tenantId: input.tenantId
      }
    });

    if (!category) {
      return null;
    }

    const updated = await this.prisma.rssFeedCategory.update({
      where: {
        id: category.id
      },
      data: {
        name: input.name,
        normalizedName: normalizeName(input.name),
        description: input.description
      },
      include: {
        feeds: {
          orderBy: [
            { createdAt: 'asc' }
          ]
        }
      }
    });

    return mapCategoryRecord(updated);
  }

  async deleteCategory(tenantId: string, categoryId: string): Promise<boolean> {
    const deleted = await this.prisma.rssFeedCategory.deleteMany({
      where: {
        id: categoryId,
        tenantId
      }
    });

    return deleted.count > 0;
  }

  async addFeed(input: CreateRssFeedInput): Promise<RssFeedRecord | null> {
    const category = await this.prisma.rssFeedCategory.findFirst({
      where: {
        id: input.categoryId,
        tenantId: input.tenantId
      }
    });

    if (!category) {
      return null;
    }

    const feed = await this.prisma.rssFeed.create({
      data: {
        categoryId: category.id,
        name: input.name,
        url: input.url
      }
    });

    return mapFeedRecord(feed);
  }

  async removeFeed(tenantId: string, categoryId: string, feedId: string): Promise<boolean> {
    const deleted = await this.prisma.rssFeed.deleteMany({
      where: {
        id: feedId,
        categoryId,
        category: {
          tenantId
        }
      }
    });

    return deleted.count > 0;
  }
}

function mapCategoryRecord(category: {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  sortOrder: number;
  feeds?: Array<{
    id: string;
    categoryId: string;
    name: string;
    url: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}): RssFeedCategoryRecord {
  return {
    id: category.id,
    tenantId: category.tenantId,
    name: category.name,
    description: category.description || '',
    sortOrder: category.sortOrder,
    feeds: (category.feeds || []).map(mapFeedRecord),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  };
}

function mapFeedRecord(feed: {
  id: string;
  categoryId: string;
  name: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}): RssFeedRecord {
  return {
    id: feed.id,
    categoryId: feed.categoryId,
    name: feed.name,
    url: feed.url,
    createdAt: feed.createdAt,
    updatedAt: feed.updatedAt
  };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
