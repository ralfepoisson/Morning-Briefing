import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerDashboardRoutes } from '../modules/dashboards/dashboard-routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: true
  });

  app.get('/health', async function handleHealth() {
    return {
      status: 'ok'
    };
  });

  await registerDashboardRoutes(app);

  return app;
}
