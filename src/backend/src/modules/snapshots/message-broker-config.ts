export type MessageBrokerConfig = {
  enabled: boolean;
  url: string | null;
  exchange: string;
  queue: string;
  retryQueue: string;
  dlq: string;
  mainRoutingKey: string;
  retryRoutingKey: string;
  deadLetterRoutingKey: string;
  retryDelayMs: number;
  maxAttempts: number;
  prefetch: number;
  reconnectDelayMs: number;
  jobLeaseSeconds: number;
  workerHealthFile: string;
};

export function getMessageBrokerConfig(env: NodeJS.ProcessEnv = process.env): MessageBrokerConfig {
  return {
    enabled: env.MESSAGE_BROKER_ENABLED === 'true',
    url: trimToNull(env.MESSAGE_BROKER_URL),
    exchange: env.MESSAGE_BROKER_EXCHANGE || 'morning-briefing.jobs',
    queue: env.MESSAGE_BROKER_QUEUE || 'morning-briefing.jobs',
    retryQueue: env.MESSAGE_BROKER_RETRY_QUEUE || 'morning-briefing.jobs.retry',
    dlq: env.MESSAGE_BROKER_DLQ || 'morning-briefing.jobs.dlq',
    mainRoutingKey: 'jobs',
    retryRoutingKey: 'retry',
    deadLetterRoutingKey: 'dead',
    retryDelayMs: positiveInteger(env.MESSAGE_BROKER_RETRY_DELAY_MS, 30_000),
    maxAttempts: positiveInteger(env.MESSAGE_BROKER_MAX_ATTEMPTS, 5),
    prefetch: positiveInteger(env.MESSAGE_BROKER_PREFETCH, 5),
    reconnectDelayMs: positiveInteger(env.MESSAGE_BROKER_RECONNECT_DELAY_MS, 1_000),
    jobLeaseSeconds: positiveInteger(env.SNAPSHOT_JOB_LEASE_SECONDS, 300),
    workerHealthFile: env.MESSAGE_BROKER_WORKER_HEALTH_FILE || '/tmp/morning-briefing-worker-ready'
  };
}

function trimToNull(value: string | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }
  return value.trim();
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
