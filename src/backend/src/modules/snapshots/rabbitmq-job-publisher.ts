import type { ChannelModel, ConfirmChannel, Message, Options } from 'amqplib';
import type { MessageBrokerConfig } from './message-broker-config.js';
import { assertRabbitMqTopology, connectRabbitMq } from './rabbitmq-connection.js';

type ConfirmPublisherChannel = {
  publish(exchange: string, routingKey: string, content: Buffer, options: Options.Publish): boolean;
  waitForConfirms(): Promise<void>;
  on(event: 'return', listener: (message: Message) => void): unknown;
};

export class RabbitMqJobPublisher {
  private readonly returnedMessageIds = new Set<string>();

  constructor(
    private readonly channel: ConfirmPublisherChannel,
    private readonly config: { exchange: string; mainRoutingKey: string }
  ) {
    this.channel.on('return', (message: Message) => {
      if (typeof message.properties.messageId === 'string') {
        this.returnedMessageIds.add(message.properties.messageId);
      }
    });
  }

  async publish(envelope: unknown, messageId: string): Promise<void> {
    this.returnedMessageIds.delete(messageId);
    this.channel.publish(
      this.config.exchange,
      this.config.mainRoutingKey,
      Buffer.from(JSON.stringify(envelope)),
      {
        persistent: true,
        mandatory: true,
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        messageId,
        timestamp: Date.now(),
        appId: 'morning-briefing'
      }
    );
    await this.channel.waitForConfirms();
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (this.returnedMessageIds.delete(messageId)) {
      throw new Error(`RabbitMQ message ${messageId} was unroutable.`);
    }
  }
}

export class ConnectedRabbitMqJobPublisher {
  private session: Promise<{ model: ChannelModel; channel: ConfirmChannel; publisher: RabbitMqJobPublisher }> | null = null;

  constructor(private readonly config: MessageBrokerConfig) {}

  async publish(envelope: unknown, messageId: string): Promise<void> {
    const session = await this.getSession();
    try {
      await session.publisher.publish(envelope, messageId);
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close(): Promise<void> {
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

  private getSession() {
    if (!this.session) {
      this.session = this.openSession();
    }
    return this.session;
  }

  private async openSession() {
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
    } catch (error) {
      await model.close().catch(() => undefined);
      throw error;
    }
  }
}
