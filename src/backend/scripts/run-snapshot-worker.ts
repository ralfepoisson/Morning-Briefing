import 'dotenv/config';
import { createQueueJobProcessor } from '../src/modules/snapshots/snapshot-runtime.js';
import { runRabbitMqWorker } from '../src/modules/snapshots/rabbitmq-worker.js';

const abortController = new AbortController();
process.once('SIGTERM', () => abortController.abort());
process.once('SIGINT', () => abortController.abort());
await runRabbitMqWorker(createQueueJobProcessor(), process.env, abortController.signal);
