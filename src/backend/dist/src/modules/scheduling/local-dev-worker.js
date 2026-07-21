import { logApplicationEvent } from '../admin/application-logger.js';
import { getMessageBrokerConfig } from '../snapshots/message-broker-config.js';
let started = false;
export function isLocalDevSnapshotWorkerEnabled(env = process.env) {
    return env.LOCAL_SNAPSHOT_WORKER_ENABLED === 'true' && env.NODE_ENV !== 'production';
}
export function startLocalDevSnapshotWorker(env = process.env) {
    if (started) {
        return;
    }
    const queueConfig = getMessageBrokerConfig(env);
    if (!queueConfig.enabled || !queueConfig.url) {
        logApplicationEvent({
            level: 'warn',
            scope: 'snapshot-jobs',
            event: 'local_snapshot_worker_not_started',
            message: 'Local snapshot worker was not started because queue configuration is incomplete.'
        });
        return;
    }
    started = true;
    logApplicationEvent({
        level: 'info',
        scope: 'snapshot-jobs',
        event: 'local_snapshot_worker_started',
        message: 'Local snapshot worker started.',
        context: {
            queueName: queueConfig.queue,
            workerPrefetch: queueConfig.prefetch,
            reconnectDelayMs: queueConfig.reconnectDelayMs
        }
    });
    void startLocalSnapshotWorkerLoop(env);
}
async function startLocalSnapshotWorkerLoop(env) {
    try {
        const [{ createQueueJobProcessor }, { runRabbitMqWorker }] = await Promise.all([
            import('../snapshots/snapshot-runtime.js'),
            import('../snapshots/rabbitmq-worker.js')
        ]);
        await runRabbitMqWorker(createQueueJobProcessor(), env);
    }
    catch (error) {
        started = false;
        logApplicationEvent({
            level: 'error',
            scope: 'snapshot-jobs',
            event: 'local_snapshot_worker_stopped',
            message: error instanceof Error ? error.message : 'Local snapshot worker stopped unexpectedly.'
        });
    }
}
