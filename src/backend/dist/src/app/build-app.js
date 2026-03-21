import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerLogRoutes } from '../modules/admin/log-routes.js';
import { registerMessageBrokerRoutes } from '../modules/admin/message-broker-routes.js';
import { registerAdminWidgetRoutes } from '../modules/admin/widget-routes.js';
import { registerConnectionRoutes } from '../modules/connections/connection-routes.js';
import { registerDashboardRoutes } from '../modules/dashboards/dashboard-routes.js';
import { registerReferenceCityRoutes } from '../modules/reference-data/reference-city-routes.js';
import { registerRssFeedRoutes } from '../modules/rss-feeds/rss-feed-routes.js';
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
    await registerConnectionRoutes(app);
    await registerLogRoutes(app);
    await registerMessageBrokerRoutes(app);
    await registerAdminWidgetRoutes(app);
    await registerReferenceCityRoutes(app);
    await registerRssFeedRoutes(app);
    await registerSnapshotRoutes(app);
    await registerWidgetRoutes(app);
    return app;
}
