import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRabbitMqTopology } from './rabbitmq-connection.js';
import { getMessageBrokerConfig } from './message-broker-config.js';

test('assertRabbitMqTopology declares durable direct exchange and quorum main, retry, and DLQ bindings', async function () {
  const exchanges: unknown[][] = [];
  const queues: unknown[][] = [];
  const bindings: unknown[][] = [];
  const channel = {
    async assertExchange(...args: unknown[]) { exchanges.push(args); return { exchange: String(args[0]) }; },
    async assertQueue(...args: unknown[]) { queues.push(args); return { queue: String(args[0]), messageCount: 0, consumerCount: 0 }; },
    async bindQueue(...args: unknown[]) { bindings.push(args); return {}; }
  };
  const config = getMessageBrokerConfig({ MESSAGE_BROKER_RETRY_DELAY_MS: '12000' });
  await assertRabbitMqTopology(channel, config);

  assert.deepEqual(exchanges, [[config.exchange, 'direct', { durable: true, autoDelete: false }]]);
  assert.equal(queues.length, 3);
  assert.deepEqual(queues[0], [config.queue, {
    durable: true, autoDelete: false, arguments: { 'x-queue-type': 'quorum' }
  }]);
  assert.deepEqual(queues[1], [config.retryQueue, {
    durable: true, autoDelete: false, messageTtl: 12000,
    deadLetterExchange: config.exchange, deadLetterRoutingKey: 'jobs',
    arguments: { 'x-queue-type': 'quorum' }
  }]);
  assert.deepEqual(queues[2], [config.dlq, {
    durable: true, autoDelete: false, arguments: { 'x-queue-type': 'quorum' }
  }]);
  assert.deepEqual(bindings, [
    [config.queue, config.exchange, 'jobs'],
    [config.retryQueue, config.exchange, 'retry'],
    [config.dlq, config.exchange, 'dead']
  ]);
});
