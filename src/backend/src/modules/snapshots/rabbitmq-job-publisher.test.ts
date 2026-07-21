import test from 'node:test';
import assert from 'node:assert/strict';
import type { Message, Options } from 'amqplib';
import { RabbitMqJobPublisher } from './rabbitmq-job-publisher.js';

test('RabbitMqJobPublisher publishes mandatory persistent messages and waits for confirms', async function () {
  const publications: Array<{ exchange: string; routingKey: string; content: Buffer; options: Options.Publish }> = [];
  let confirmed = false;
  const publisher = new RabbitMqJobPublisher({
    publish(exchange, routingKey, content, options) {
      publications.push({ exchange, routingKey, content, options });
      return true;
    },
    async waitForConfirms() {
      confirmed = true;
    },
    on() {
      return this;
    }
  }, {
    exchange: 'briefing.jobs',
    mainRoutingKey: 'jobs'
  });

  await publisher.publish({ type: 'Example', payload: { jobId: 'job-1' } }, 'job-1');

  assert.equal(confirmed, true);
  assert.equal(publications.length, 1);
  assert.equal(publications[0].exchange, 'briefing.jobs');
  assert.equal(publications[0].routingKey, 'jobs');
  assert.deepEqual(JSON.parse(publications[0].content.toString('utf8')), {
    type: 'Example',
    payload: { jobId: 'job-1' }
  });
  assert.equal(publications[0].options.persistent, true);
  assert.equal(publications[0].options.mandatory, true);
  assert.equal(publications[0].options.contentType, 'application/json');
  assert.equal(publications[0].options.messageId, 'job-1');
});

test('RabbitMqJobPublisher rejects an unroutable mandatory message', async function () {
  let returnHandler: ((message: Message) => void) | null = null;
  const publisher = new RabbitMqJobPublisher({
    publish(_exchange, _routingKey, _content, options) {
      returnHandler?.({ properties: { messageId: String(options.messageId) } } as Message);
      return true;
    },
    async waitForConfirms() {},
    on(event, handler) {
      if (event === 'return') {
        returnHandler = handler;
      }
      return this;
    }
  }, {
    exchange: 'briefing.jobs',
    mainRoutingKey: 'jobs'
  });

  await assert.rejects(publisher.publish({ type: 'Example' }, 'job-unroutable'), /unroutable/);
});
