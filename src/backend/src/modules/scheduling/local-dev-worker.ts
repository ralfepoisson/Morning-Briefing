import { logApplicationEvent } from '../admin/application-logger.js';
import { getSnapshotQueueConfig } from '../snapshots/snapshot-queue-config.js';

let started = false;

export function isLocalDevSnapshotWorkerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LOCAL_SNAPSHOT_WORKER_ENABLED === 'true' && env.NODE_ENV !== 'production';
}

export function startLocalDevSnapshotWorker(env: NodeJS.ProcessEnv = process.env): void {
  if (started) {
    return;
  }

  const queueConfig = getSnapshotQueueConfig(env);

  if (!queueConfig.enabled || !queueConfig.queueUrl) {
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
      queueUrl: queueConfig.queueUrl,
      workerMaxMessages: queueConfig.workerMaxMessages,
      workerPollIntervalMs: queueConfig.workerPollIntervalMs
    }
  });

  void startLocalSnapshotWorkerLoop(env);
}

async function startLocalSnapshotWorkerLoop(env: NodeJS.ProcessEnv): Promise<void> {
  try {
    const [{ createQueueJobProcessor }, { createSnapshotSqsClient }, { runSnapshotWorkerLoop }] = await Promise.all([
      import('../snapshots/snapshot-runtime.js'),
      import('../snapshots/snapshot-sqs-client.js'),
      import('../snapshots/snapshot-worker.js')
    ]);

    await runSnapshotWorkerLoop(createSnapshotSqsClient(), createQueueJobProcessor(), env);
  } catch (error) {
    started = false;
    logApplicationEvent({
      level: 'error',
      scope: 'snapshot-jobs',
      event: 'local_snapshot_worker_stopped',
      message: error instanceof Error ? error.message : 'Local snapshot worker stopped unexpectedly.'
    });
  }
}
