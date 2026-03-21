export class RssFeedService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async listForTenant(tenantId) {
        const categories = await this.repository.listCategories(tenantId);
        return categories.map(toCategoryResponse);
    }
    async createCategory(input) {
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
    async updateCategory(input) {
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
    async deleteCategory(tenantId, categoryId) {
        const deleted = await this.repository.deleteCategory(tenantId, categoryId);
        if (!deleted) {
            throw new Error('Category not found.');
        }
    }
    async addFeed(input) {
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
    async removeFeed(tenantId, categoryId, feedId) {
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
function toCategoryResponse(category) {
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
function toFeedResponse(feed) {
    return {
        id: feed.id,
        name: feed.name,
        url: feed.url,
        createdAt: feed.createdAt.toISOString(),
        updatedAt: feed.updatedAt.toISOString()
    };
}
function sanitizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function sanitizeUrl(value) {
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
    }
    catch {
        return '';
    }
}
