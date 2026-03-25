import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerAdminConnectorRoutes } from '../modules/admin/connector-routes.js';
import { assertAuthenticatedRequest } from '../modules/default-user/default-user-service.js';
import { registerLogRoutes } from '../modules/admin/log-routes.js';
import { registerMessageBrokerRoutes } from '../modules/admin/message-broker-routes.js';
import { registerAdminWidgetRoutes } from '../modules/admin/widget-routes.js';
import { registerConnectionRoutes } from '../modules/connections/connection-routes.js';
import { registerDashboardRoutes } from '../modules/dashboards/dashboard-routes.js';
import { registerReferenceCityRoutes } from '../modules/reference-data/reference-city-routes.js';
import { registerRssFeedRoutes } from '../modules/rss-feeds/rss-feed-routes.js';
import { registerSnapshotRoutes } from '../modules/snapshots/snapshot-routes.js';
import { registerUserRoutes } from '../modules/users/user-routes.js';
import { registerWidgetRoutes } from '../modules/widgets/widget-routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type']
  });

  app.get('/health', async function handleHealth() {
    return {
      status: 'ok'
    };
  });

  app.addHook('onRequest', async function authenticateApiRequests(request, reply) {
    if (request.method === 'OPTIONS') {
      return;
    }

    if (!isProtectedApiRoute(request.url)) {
      return;
    }

    try {
      assertAuthenticatedRequest(request);
    } catch (error) {
      reply.code(401);
      return reply.send({
        message: error instanceof Error ? error.message : 'Authentication is required.'
      });
    }
  });

  await registerDashboardRoutes(app);
  await registerConnectionRoutes(app);
  await registerLogRoutes(app);
  await registerMessageBrokerRoutes(app);
  await registerAdminConnectorRoutes(app);
  await registerAdminWidgetRoutes(app);
  await registerReferenceCityRoutes(app);
  await registerRssFeedRoutes(app);
  await registerSnapshotRoutes(app);
  await registerUserRoutes(app);
  await registerWidgetRoutes(app);

  return app;
}

function isProtectedApiRoute(url: string): boolean {
  const pathname = url.split('?')[0];

  if (!pathname.startsWith('/api/v1')) {
    return false;
  }

  return pathname !== '/api/v1/connections/google-calendar/oauth/callback';
}
