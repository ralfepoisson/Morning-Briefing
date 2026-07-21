import { assertRabbitMqTopology, connectRabbitMq } from './rabbitmq-connection.js';
export class RabbitMqJobPublisher {
    channel;
    config;
    returnedMessageIds = new Set();
    constructor(channel, config) {
        this.channel = channel;
        this.config = config;
        this.channel.on('return', (message) => {
            if (typeof message.properties.messageId === 'string') {
                this.returnedMessageIds.add(message.properties.messageId);
            }
        });
    }
    async publish(envelope, messageId) {
        this.returnedMessageIds.delete(messageId);
        this.channel.publish(this.config.exchange, this.config.mainRoutingKey, Buffer.from(JSON.stringify(envelope)), {
            persistent: true,
            mandatory: true,
            contentType: 'application/json',
            contentEncoding: 'utf-8',
            messageId,
            timestamp: Date.now(),
            appId: 'morning-briefing'
        });
        await this.channel.waitForConfirms();
        await new Promise((resolve) => setImmediate(resolve));
        if (this.returnedMessageIds.delete(messageId)) {
            throw new Error(`RabbitMQ message ${messageId} was unroutable.`);
        }
    }
}
export class ConnectedRabbitMqJobPublisher {
    config;
    session = null;
    constructor(config) {
        this.config = config;
    }
    async publish(envelope, messageId) {
        const session = await this.getSession();
        try {
            await session.publisher.publish(envelope, messageId);
        }
        catch (error) {
            await this.close();
            throw error;
        }
    }
    async close() {
        const pending = this.session;
        this.session = null;
        if (!pending) {
            return;
        }
        const session = await pending.catch(() => null);
        if (session) {
            await session.channel.close().catch(() => undefined);
            await session.model.close().catch(() => undefined);
        }
    }
    getSession() {
        if (!this.session) {
            this.session = this.openSession();
        }
        return this.session;
    }
    async openSession() {
        const model = await connectRabbitMq(this.config);
        model.on('error', () => undefined);
        model.on('close', () => {
            this.session = null;
        });
        try {
            const channel = await model.createConfirmChannel();
            channel.on('error', () => undefined);
            channel.on('close', () => {
                this.session = null;
            });
            await assertRabbitMqTopology(channel, this.config);
            return {
                model,
                channel,
                publisher: new RabbitMqJobPublisher(channel, this.config)
            };
        }
        catch (error) {
            await model.close().catch(() => undefined);
            throw error;
        }
    }
}
