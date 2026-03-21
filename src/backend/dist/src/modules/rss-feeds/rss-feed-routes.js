import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { PrismaRssFeedRepository } from './prisma-rss-feed-repository.js';
import { RssFeedService } from './rss-feed-service.js';
export async function registerRssFeedRoutes(app, dependencies = createRssFeedRouteDependencies()) {
    const rssFeedService = dependencies.rssFeedService;
    const defaultUserService = dependencies.defaultUserService;
    app.get('/api/v1/rss-feeds', async function handleListRssFeeds() {
        const user = await defaultUserService.getDefaultUser();
        const items = await rssFeedService.listForTenant(user.tenantId);
        return {
            items
        };
    });
    app.post('/api/v1/rss-feeds/categories', async function handleCreateCategory(request, reply) {
        const body = request.body;
        try {
            const user = await defaultUserService.getDefaultUser();
            const category = await rssFeedService.createCategory({
                tenantId: user.tenantId,
                name: typeof body?.name === 'string' ? body.name : '',
                description: typeof body?.description === 'string' ? body.description : ''
            });
            reply.code(201);
            return category;
        }
        catch (error) {
            if (isUserInputError(error)) {
                reply.code(400);
                return {
                    message: error.message
                };
            }
            throw error;
        }
    });
    app.patch('/api/v1/rss-feeds/categories/:categoryId', async function handleUpdateCategory(request, reply) {
        const params = request.params;
        const body = request.body;
        if (!params.categoryId) {
            reply.code(400);
            return {
                message: 'Category id is required.'
            };
        }
        try {
            const user = await defaultUserService.getDefaultUser();
            const category = await rssFeedService.updateCategory({
                tenantId: user.tenantId,
                categoryId: params.categoryId,
                name: typeof body?.name === 'string' ? body.name : '',
                description: typeof body?.description === 'string' ? body.description : ''
            });
            return category;
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Category not found.') {
                reply.code(404);
                return {
                    message: error.message
                };
            }
            if (isUserInputError(error)) {
                reply.code(400);
                return {
                    message: error.message
                };
            }
            throw error;
        }
    });
    app.delete('/api/v1/rss-feeds/categories/:categoryId', async function handleDeleteCategory(request, reply) {
        const params = request.params;
        if (!params.categoryId) {
            reply.code(400);
            return {
                message: 'Category id is required.'
            };
        }
        try {
            const user = await defaultUserService.getDefaultUser();
            await rssFeedService.deleteCategory(user.tenantId, params.categoryId);
            reply.code(204);
            return null;
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Category not found.') {
                reply.code(404);
                return {
                    message: error.message
                };
            }
            throw error;
        }
    });
    app.post('/api/v1/rss-feeds/categories/:categoryId/feeds', async function handleAddFeed(request, reply) {
        const params = request.params;
        const body = request.body;
        if (!params.categoryId) {
            reply.code(400);
            return {
                message: 'Category id is required.'
            };
        }
        try {
            const user = await defaultUserService.getDefaultUser();
            const category = await rssFeedService.addFeed({
                tenantId: user.tenantId,
                categoryId: params.categoryId,
                name: typeof body?.name === 'string' ? body.name : '',
                url: typeof body?.url === 'string' ? body.url : ''
            });
            reply.code(201);
            return category;
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Category not found.') {
                reply.code(404);
                return {
                    message: error.message
                };
            }
            if (isUserInputError(error)) {
                reply.code(400);
                return {
                    message: error.message
                };
            }
            throw error;
        }
    });
    app.delete('/api/v1/rss-feeds/categories/:categoryId/feeds/:feedId', async function handleDeleteFeed(request, reply) {
        const params = request.params;
        if (!params.categoryId || !params.feedId) {
            reply.code(400);
            return {
                message: 'Category id and feed id are required.'
            };
        }
        try {
            const user = await defaultUserService.getDefaultUser();
            const category = await rssFeedService.removeFeed(user.tenantId, params.categoryId, params.feedId);
            return category;
        }
        catch (error) {
            if (error instanceof Error && (error.message === 'Feed not found.' || error.message === 'Category not found.')) {
                reply.code(404);
                return {
                    message: error.message
                };
            }
            throw error;
        }
    });
}
function createRssFeedRouteDependencies() {
    const prisma = getPrismaClient();
    return {
        rssFeedService: new RssFeedService(new PrismaRssFeedRepository(prisma)),
        defaultUserService: new DefaultUserService(prisma)
    };
}
function isUserInputError(error) {
    return error instanceof Error && (error.message === 'Category name is required.' ||
        error.message === 'A category with that name already exists.' ||
        error.message === 'Feed name is required.' ||
        error.message === 'A valid feed URL is required.' ||
        error.message === 'That feed URL already exists in this category.');
}
