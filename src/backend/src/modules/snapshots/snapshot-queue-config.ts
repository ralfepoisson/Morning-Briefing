export type SnapshotQueueConfig = {
  enabled: boolean;
  queueUrl: string | null;
  queueName: string;
  dlqName: string;
  awsRegion: string;
  awsEndpointUrl: string | null;
  workerWaitTimeSeconds: number;
  workerVisibilityTimeoutSeconds: number;
  workerMaxMessages: number;
  workerPollIntervalMs: number;
  queueMaxReceiveCount: number;
};

export function getSnapshotQueueConfig(env: NodeJS.ProcessEnv = process.env): SnapshotQueueConfig {
  return {
    enabled: env.SNAPSHOT_QUEUE_ENABLED === 'true',
    queueUrl: trimToNull(env.SNAPSHOT_QUEUE_URL),
    queueName: env.SNAPSHOT_QUEUE_NAME || 'morning-briefing-snapshot-jobs',
    dlqName: env.SNAPSHOT_DLQ_NAME || 'morning-briefing-snapshot-jobs-dlq',
    awsRegion: env.AWS_REGION || 'eu-west-3',
    awsEndpointUrl: trimToNull(env.AWS_ENDPOINT_URL_SQS),
    workerWaitTimeSeconds: clampNumber(env.SNAPSHOT_WORKER_WAIT_TIME_SECONDS, 10),
    workerVisibilityTimeoutSeconds: clampNumber(env.SNAPSHOT_WORKER_VISIBILITY_TIMEOUT_SECONDS, 60),
    workerMaxMessages: clampNumber(env.SNAPSHOT_WORKER_MAX_MESSAGES, 5),
    workerPollIntervalMs: clampNumber(env.SNAPSHOT_WORKER_POLL_INTERVAL_MS, 1000),
    queueMaxReceiveCount: clampNumber(env.SNAPSHOT_QUEUE_MAX_RECEIVE_COUNT, 5)
  };
}

function trimToNull(value: string | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  return value.trim();
}

function clampNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}
