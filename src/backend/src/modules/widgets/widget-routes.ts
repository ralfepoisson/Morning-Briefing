import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { PrismaWidgetRepository } from './prisma-widget-repository.js';
import { WidgetService } from './widget-service.js';

export type WidgetRouteDependencies = {
  widgetService: Pick<WidgetService, 'listForDashboard' | 'create' | 'update'>;
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
};

export async function registerWidgetRoutes(
  app: FastifyInstance,
  dependencies: WidgetRouteDependencies = createWidgetRouteDependencies()
): Promise<void> {
  const widgetService = dependencies.widgetService;
  const defaultUserService = dependencies.defaultUserService;

  app.get('/api/v1/dashboards/:dashboardId/widgets', async function handleListWidgets(request, reply) {
    const params = request.params as { dashboardId?: string };

    if (!params.dashboardId) {
      reply.code(400);
      return {
        message: 'Dashboard id is required.'
      };
    }

    const user = await defaultUserService.getDefaultUser();
    const widgets = await widgetService.listForDashboard(params.dashboardId, user.userId);

    return {
      items: widgets
    };
  });

  app.post('/api/v1/dashboards/:dashboardId/widgets', async function handleCreateWidget(request, reply) {
    const params = request.params as { dashboardId?: string };
    const body = request.body as { type?: string };

    if (!params.dashboardId) {
      reply.code(400);
      return {
        message: 'Dashboard id is required.'
      };
    }

    if (!body || typeof body.type !== 'string' || !body.type.trim()) {
      reply.code(400);
      return {
        message: 'Widget type is required.'
      };
    }

    try {
      const user = await defaultUserService.getDefaultUser();
      const widget = await widgetService.create({
        dashboardId: params.dashboardId,
        ownerUserId: user.userId,
        type: body.type.trim()
      });

      reply.code(201);
      return widget;
    } catch (error) {
      if (error instanceof Error && error.message === 'Dashboard not found.') {
        reply.code(404);
        return {
          message: error.message
        };
      }

      if (error instanceof Error && error.message === 'Widget type is not supported.') {
        reply.code(400);
        return {
          message: error.message
        };
      }

      throw error;
    }
  });

  app.patch('/api/v1/dashboards/:dashboardId/widgets/:widgetId', async function handleUpdateWidget(request, reply) {
    const params = request.params as {
      dashboardId?: string;
      widgetId?: string;
    };
    const body = request.body as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      config?: Record<string, unknown>;
    };

    if (!params.dashboardId) {
      reply.code(400);
      return {
        message: 'Dashboard id is required.'
      };
    }

    if (!params.widgetId) {
      reply.code(400);
      return {
        message: 'Widget id is required.'
      };
    }

    if (!body || typeof body.x !== 'number' || typeof body.y !== 'number' || typeof body.width !== 'number' || typeof body.height !== 'number') {
      reply.code(400);
      return {
        message: 'Widget layout is required.'
      };
    }

    const user = await defaultUserService.getDefaultUser();
    const widget = await widgetService.update({
      dashboardId: params.dashboardId,
      widgetId: params.widgetId,
      ownerUserId: user.userId,
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
      config: body.config
    });

    if (!widget) {
      reply.code(404);
      return {
        message: 'Widget not found.'
      };
    }

    return widget;
  });
}

function createWidgetRouteDependencies(): WidgetRouteDependencies {
  const prisma = getPrismaClient();

  return {
    widgetService: new WidgetService(new PrismaWidgetRepository(prisma)),
    defaultUserService: new DefaultUserService(prisma)
  };
}
