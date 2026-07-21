import { chmod, unlink, writeFile } from 'node:fs/promises';
import type { ConfirmChannel, ConsumeMessage, Message, Options } from 'amqplib';
import { logSnapshotJob } from './snapshot-job-logger.js';
import { getMessageBrokerConfig, type MessageBrokerConfig } from './message-broker-config.js';
import { assertRabbitMqTopology, connectRabbitMq } from './rabbitmq-connection.js';

type JobProcessor = {
  process(message: { body: string; messageId?: string; receiptHandle?: string }): Promise<unknown>;
};

type DeliveryChannel = {
  ack(message: Message): void;
  nack(message: Message, allUpTo?: boolean, requeue?: boolean): void;
  publish(exchange: string, routingKey: string, content: Buffer, options: Options.Publish): boolean;
  waitForConfirms(): Promise<void>;
  on(event: 'return', listener: (message: Message) => void): unknown;
  removeListener(event: 'return', listener: (message: Message) => void): unknown;
};

type DeliveryConfig = Pick<
  MessageBrokerConfig,
  'exchange' | 'retryRoutingKey' | 'deadLetterRoutingKey' | 'retryQueue' | 'maxAttempts'
>;

export async function handleRabbitMqDelivery(
  channel: DeliveryChannel,
  message: Message,
  processor: JobProcessor,
  config: DeliveryConfig
): Promise<void> {
  let destination: 'retry' | 'dead' | null = null;
  const retryCount = getRetryCount(message, config.retryQueue);
  try {
    const result = await processor.process({
      body: message.content.toString('utf8'),
      messageId: typeof message.properties.messageId === 'string' ? message.properties.messageId : undefined
    });
    if (result === 'retry') {
      destination = retryCount >= config.maxAttempts - 1 ? 'dead' : 'retry';
    }
  } catch (error) {
    destination = isInvalidQueueMessageError(error) || retryCount >= config.maxAttempts - 1
      ? 'dead'
      : 'retry';
    logSnapshotJob(destination === 'dead' ? 'error' : 'warn', 'message_broker_delivery_failed', {
      messageId: typeof message.properties.messageId === 'string' ? message.properties.messageId : null,
      destination,
      retryCount,
      error: error instanceof Error ? error.message : 'Message processing failed.'
    });
  }

  if (!destination) {
    channel.ack(message);
    return;
  }

  try {
    const routingKey = destination === 'retry' ? config.retryRoutingKey : config.deadLetterRoutingKey;
    await publishConfirmed(
      channel,
      config.exchange,
      routingKey,
      message,
      destination === 'retry' ? retryCount + 1 : retryCount
    );
    channel.ack(message);
  } catch (error) {
    channel.nack(message, false, true);
    logSnapshotJob('error', 'message_broker_forward_failed', {
      messageId: typeof message.properties.messageId === 'string' ? message.properties.messageId : null,
      destination,
      error: error instanceof Error ? error.message : 'RabbitMQ confirm failed.'
    });
  }
}

async function publishConfirmed(
  channel: DeliveryChannel,
  exchange: string,
  routingKey: string,
  message: Message,
  retryCount: number
): Promise<void> {
  const messageId = typeof message.properties.messageId === 'string'
    ? message.properties.messageId
    : `delivery-${message.fields.deliveryTag}-${Date.now()}`;
  let returned = false;
  const handleReturn = (returnedMessage: Message) => {
    if (returnedMessage.properties.messageId === messageId) {
      returned = true;
    }
  };
  channel.on('return', handleReturn);
  try {
    channel.publish(exchange, routingKey, message.content, {
      ...forwardOptions(message.properties, retryCount),
      messageId
    });
    await channel.waitForConfirms();
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (returned) {
      throw new Error(`RabbitMQ forwarding destination ${routingKey} was unroutable.`);
    }
  } finally {
    channel.removeListener('return', handleReturn);
  }
}

export async function runRabbitMqWorker(
  processor: JobProcessor,
  env: NodeJS.ProcessEnv = process.env,
  signal: AbortSignal = new AbortController().signal
): Promise<void> {
  const config = getMessageBrokerConfig(env);
  if (!config.enabled || !config.url) {
    throw new Error('MESSAGE_BROKER_ENABLED=true and MESSAGE_BROKER_URL are required to run the worker.');
  }

  while (!signal.aborted) {
    try {
      await runConnectedWorker(processor, config, signal);
    } catch (error) {
      await removeHealthFile(config.workerHealthFile);
      if (!signal.aborted) {
        logSnapshotJob('error', 'message_broker_worker_disconnected', {
          error: error instanceof Error ? error.message : 'RabbitMQ worker disconnected.'
        });
        await abortableDelay(config.reconnectDelayMs, signal);
      }
    }
  }
  await removeHealthFile(config.workerHealthFile);
}

async function runConnectedWorker(
  processor: JobProcessor,
  config: MessageBrokerConfig,
  signal: AbortSignal
): Promise<void> {
  const model = await connectRabbitMq(config);
  const channel = await model.createConfirmChannel();
  const inFlight = new Set<Promise<void>>();
  let consumerTag: string | null = null;
  try {
    await assertRabbitMqTopology(channel, config);
    await channel.prefetch(config.prefetch, false);
    const consumer = await channel.consume(config.queue, (message: ConsumeMessage | null) => {
      if (!message) {
        return;
      }
      const processing = handleRabbitMqDelivery(channel, message, processor, config)
        .catch((error) => {
          logSnapshotJob('error', 'message_broker_delivery_handler_failed', {
            error: error instanceof Error ? error.message : 'Delivery handler failed.'
          });
        })
        .finally(() => inFlight.delete(processing));
      inFlight.add(processing);
    }, { noAck: false });
    consumerTag = consumer.consumerTag;
    await markWorkerReady(config.workerHealthFile);
    logSnapshotJob('info', 'message_broker_worker_ready', {
      queue: config.queue,
      prefetch: config.prefetch
    });
    await waitForDisconnect(model, channel, signal);
  } finally {
    await removeHealthFile(config.workerHealthFile);
    if (consumerTag) {
      await channel.cancel(consumerTag).catch(() => undefined);
    }
    await Promise.allSettled([...inFlight]);
    await channel.close().catch(() => undefined);
    await model.close().catch(() => undefined);
  }
}

function forwardOptions(properties: Message['properties'], retryCount: number): Options.Publish {
  return {
    persistent: true,
    mandatory: true,
    contentType: properties.contentType || 'application/json',
    contentEncoding: properties.contentEncoding || 'utf-8',
    headers: {
      ...(properties.headers || {}),
      'x-morning-briefing-retry-count': retryCount
    },
    correlationId: properties.correlationId,
    messageId: properties.messageId,
    timestamp: properties.timestamp || Date.now(),
    type: properties.type,
    appId: properties.appId || 'morning-briefing'
  };
}

function getRetryCount(message: Message, retryQueue: string): number {
  const applicationRetryCount = Number(message.properties.headers?.['x-morning-briefing-retry-count']);
  if (Number.isInteger(applicationRetryCount) && applicationRetryCount >= 0) {
    return applicationRetryCount;
  }
  const deaths = message.properties.headers?.['x-death'];
  if (!Array.isArray(deaths)) {
    return 0;
  }
  return deaths.reduce((total, death) => {
    if (!death || death.queue !== retryQueue) {
      return total;
    }
    const count = Number(death.count);
    return Number.isFinite(count) && count > 0 ? total + count : total;
  }, 0);
}

function isInvalidQueueMessageError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return [
    'Queue message type is invalid.',
    'Snapshot queue message is invalid.',
    'Snapshot queue message payload is invalid.',
    'Dashboard briefing queue message is invalid.',
    'Dashboard briefing queue message payload is invalid.'
  ].includes(error.message);
}

async function markWorkerReady(file: string): Promise<void> {
  await writeFile(file, `${new Date().toISOString()}\n`, { mode: 0o600 });
  await chmod(file, 0o600);
}

async function removeHealthFile(file: string): Promise<void> {
  await unlink(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  });
}

async function waitForDisconnect(
  model: {
    once(event: string, listener: (...args: any[]) => void): unknown;
    removeListener(event: string, listener: (...args: any[]) => void): unknown;
  },
  channel: {
    once(event: string, listener: (...args: any[]) => void): unknown;
    removeListener(event: string, listener: (...args: any[]) => void): unknown;
  },
  signal: AbortSignal
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
      model.removeListener('close', onClose);
      channel.removeListener('close', onClose);
      model.removeListener('error', onError);
      channel.removeListener('error', onError);
    };
    const onAbort = () => { cleanup(); resolve(); };
    const onClose = () => { cleanup(); resolve(); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    signal.addEventListener('abort', onAbort, { once: true });
    model.once('close', onClose);
    channel.once('close', onClose);
    model.once('error', onError);
    channel.once('error', onError);
  });
}

async function abortableDelay(durationMs: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, durationMs);
    signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}
