import 'dotenv/config';
import { buildApp } from './build-app.js';
import { logApplicationEvent } from '../modules/admin/application-logger.js';
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
async function start() {
    const app = await buildApp();
    try {
        await app.listen({
            port,
            host
        });
        logApplicationEvent({
            level: 'info',
            scope: 'backend',
            event: 'backend_started',
            message: `Backend listening on http://${host}:${port}`,
            context: {
                host,
                port
            }
        });
    }
    catch (error) {
        logApplicationEvent({
            level: 'error',
            scope: 'backend',
            event: 'backend_start_failed',
            message: 'Backend failed to start.',
            context: {
                error: error instanceof Error ? error.message : String(error)
            }
        });
        process.exit(1);
    }
}
start();
