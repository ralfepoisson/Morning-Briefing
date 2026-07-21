import test from 'node:test';
import assert from 'node:assert/strict';
import type { Message, Options } from 'amqplib';
import { handleRabbitMqDelivery } from './rabbitmq-worker.js';

function message(body: string, deathCount = 0, applicationRetryCount?: number): Message {
  return {
    content: Buffer.from(body),
    fields: { deliveryTag: 1, redelivered: deathCount > 0, exchange: 'briefing.jobs', routingKey: 'jobs' },
    properties: {
      messageId: 'message-1',
      contentType: 'application/json',
      headers: {
        ...(deathCount ? { 'x-death': [{ queue: 'briefing.jobs.retry', count: deathCount }] } : {}),
        ...(applicationRetryCount === undefined ? {} : { 'x-morning-briefing-retry-count': applicationRetryCount })
      }
    }
  } as Message;
}

function channelFixture() {
  const events: string[] = [];
  const publications: Array<{ routingKey: string; body: string; options: Options.Publish }> = [];
  return {
    events,
    publications,
    channel: {
      ack() { events.push('ack'); },
      nack() { events.push('nack'); },
      on() { return this; },
      removeListener() { return this; },
      publish(_exchange: string, routingKey: string, content: Buffer, options: Options.Publish) {
        publications.push({ routingKey, body: content.toString('utf8'), options });
        events.push(`publish:${routingKey}`);
        return true;
      },
      async waitForConfirms() { events.push('confirm'); }
    }
  };
}

const config = {
  exchange: 'briefing.jobs',
  retryRoutingKey: 'retry',
  deadLetterRoutingKey: 'dead',
  retryQueue: 'briefing.jobs.retry',
  maxAttempts: 3
};

test('handleRabbitMqDelivery manually acknowledges only after successful processing', async function () {
  const fixture = channelFixture();
  await handleRabbitMqDelivery(fixture.channel, message('{"type":"ok"}'), {
    async process() { return 'processed'; }
  }, config);
  assert.deepEqual(fixture.events, ['ack']);
});

test('handleRabbitMqDelivery confirms retry publication before acknowledging a retryable failure', async function () {
  const fixture = channelFixture();
  await handleRabbitMqDelivery(fixture.channel, message('{"type":"ok"}'), {
    async process() { throw new Error('temporary'); }
  }, config);
  assert.deepEqual(fixture.events, ['publish:retry', 'confirm', 'ack']);
  assert.equal(fixture.publications.length, 1);
  assert.equal(fixture.publications[0].options.headers['x-morning-briefing-retry-count'], 1);
});

test('handleRabbitMqDelivery confirms exhausted delivery to terminal DLQ before acknowledging', async function () {
  const fixture = channelFixture();
  await handleRabbitMqDelivery(fixture.channel, message('{"type":"ok"}', 2), {
    async process() { throw new Error('still failing'); }
  }, config);
  assert.deepEqual(fixture.events, ['publish:dead', 'confirm', 'ack']);
});

test('handleRabbitMqDelivery sends invalid messages directly to terminal DLQ', async function () {
  const fixture = channelFixture();
  await handleRabbitMqDelivery(fixture.channel, message('{"type":"Unknown"}'), {
    async process() { throw new Error('Queue message type is invalid.'); }
  }, config);
  assert.deepEqual(fixture.events, ['publish:dead', 'confirm', 'ack']);
});

test('handleRabbitMqDelivery terminally routes an exhausted active-lease retry', async function () {
  const fixture = channelFixture();
  await handleRabbitMqDelivery(fixture.channel, message('{"type":"ok"}', 2), {
    async process() { return 'retry'; }
  }, config);
  assert.deepEqual(fixture.events, ['publish:dead', 'confirm', 'ack']);
});

test('handleRabbitMqDelivery trusts the worker retry header when x-death remains compressed', async function () {
  const fixture = channelFixture();
  await handleRabbitMqDelivery(fixture.channel, message('{"type":"ok"}', 1, 2), {
    async process() { throw new Error('third attempt'); }
  }, config);
  assert.deepEqual(fixture.events, ['publish:dead', 'confirm', 'ack']);
});

test('handleRabbitMqDelivery requeues the source when confirmed forwarding fails', async function () {
  const fixture = channelFixture();
  fixture.channel.waitForConfirms = async function waitForConfirms() {
    throw new Error('confirm failed');
  };
  await handleRabbitMqDelivery(fixture.channel, message('{"type":"ok"}'), {
    async process() { throw new Error('temporary'); }
  }, config);
  assert.deepEqual(fixture.events, ['publish:retry', 'nack']);
});
