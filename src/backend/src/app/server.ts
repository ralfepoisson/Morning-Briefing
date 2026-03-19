import 'dotenv/config';
import { buildApp } from './build-app.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      port,
      host
    });
    console.log(`Backend listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
