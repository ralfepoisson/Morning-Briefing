import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerDashboardRoutes } from '../modules/dashboards/dashboard-routes.js';
import { registerReferenceCityRoutes } from '../modules/reference-data/reference-city-routes.js';
import { registerSnapshotRoutes } from '../modules/snapshots/snapshot-routes.js';
import { registerWidgetRoutes } from '../modules/widgets/widget-routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
  });

  app.get('/health', async function handleHealth() {
    return {
      status: 'ok'
    };
  });

  await registerDashboardRoutes(app);
  await registerReferenceCityRoutes(app);
  await registerSnapshotRoutes(app);
  await registerWidgetRoutes(app);

  return app;
}
