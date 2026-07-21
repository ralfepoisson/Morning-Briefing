import { connect } from 'amqplib';
import { getMessageBrokerConfig } from './message-broker-config.js';
export async function connectRabbitMq(config) {
    if (!config.url) {
        throw new Error('MESSAGE_BROKER_URL is required when the message broker is enabled.');
    }
    const connectionUrl = new URL(config.url);
    if (!connectionUrl.searchParams.has('heartbeat')) {
        connectionUrl.searchParams.set('heartbeat', '30');
    }
    return connect(connectionUrl.toString(), {
        clientProperties: { connection_name: 'morning-briefing' }
    });
}
export async function assertRabbitMqTopology(channel, config) {
    await channel.assertExchange(config.exchange, 'direct', {
        durable: true,
        autoDelete: false
    });
    await channel.assertQueue(config.queue, {
        durable: true,
        autoDelete: false,
        arguments: { 'x-queue-type': 'quorum' }
    });
    await channel.assertQueue(config.retryQueue, {
        durable: true,
        autoDelete: false,
        messageTtl: config.retryDelayMs,
        deadLetterExchange: config.exchange,
        deadLetterRoutingKey: config.mainRoutingKey,
        arguments: { 'x-queue-type': 'quorum' }
    });
    await channel.assertQueue(config.dlq, {
        durable: true,
        autoDelete: false,
        arguments: { 'x-queue-type': 'quorum' }
    });
    await channel.bindQueue(config.queue, config.exchange, config.mainRoutingKey);
    await channel.bindQueue(config.retryQueue, config.exchange, config.retryRoutingKey);
    await channel.bindQueue(config.dlq, config.exchange, config.deadLetterRoutingKey);
    return {
        mainQueue: config.queue,
        retryQueue: config.retryQueue,
        deadLetterQueue: config.dlq
    };
}
export async function checkRabbitMqReadiness(env = process.env) {
    const config = getMessageBrokerConfig(env);
    if (!config.enabled) {
        return;
    }
    const model = await connectRabbitMq(config);
    const channel = await model.createChannel();
    try {
        await assertRabbitMqTopology(channel, config);
    }
    finally {
        await channel.close().catch(() => undefined);
        await model.close().catch(() => undefined);
    }
}
export async function readRabbitMqQueueStats(env = process.env) {
    const config = getMessageBrokerConfig(env);
    if (!config.enabled || !config.url) {
        throw new Error('RabbitMQ is not configured.');
    }
    const model = await connectRabbitMq(config);
    const channel = await model.createChannel();
    try {
        const [main, retry, dead] = await Promise.all([
            channel.checkQueue(config.queue),
            channel.checkQueue(config.retryQueue),
            channel.checkQueue(config.dlq)
        ]);
        return {
            readyMessages: main.messageCount,
            retryMessages: retry.messageCount,
            deadLetterMessages: dead.messageCount,
            consumerCount: main.consumerCount
        };
    }
    finally {
        await channel.close().catch(() => undefined);
        await model.close().catch(() => undefined);
    }
}
