import test from 'node:test';
import assert from 'node:assert/strict';
import { getMessageBrokerConfig } from './message-broker-config.js';

test('getMessageBrokerConfig builds the bounded durable RabbitMQ contract', function () {
  const config = getMessageBrokerConfig({
    MESSAGE_BROKER_ENABLED: 'true',
    MESSAGE_BROKER_URL: 'amqp://user:secret@rabbitmq:5672',
    MESSAGE_BROKER_EXCHANGE: 'briefing.jobs',
    MESSAGE_BROKER_QUEUE: 'briefing.jobs.main',
    MESSAGE_BROKER_RETRY_QUEUE: 'briefing.jobs.retry',
    MESSAGE_BROKER_DLQ: 'briefing.jobs.dlq',
    MESSAGE_BROKER_RETRY_DELAY_MS: '15000',
    MESSAGE_BROKER_MAX_ATTEMPTS: '5',
    MESSAGE_BROKER_PREFETCH: '3'
  });

  assert.equal(config.enabled, true);
  assert.equal(config.url, 'amqp://user:secret@rabbitmq:5672');
  assert.equal(config.exchange, 'briefing.jobs');
  assert.equal(config.queue, 'briefing.jobs.main');
  assert.equal(config.retryQueue, 'briefing.jobs.retry');
  assert.equal(config.dlq, 'briefing.jobs.dlq');
  assert.equal(config.retryDelayMs, 15000);
  assert.equal(config.maxAttempts, 5);
  assert.equal(config.prefetch, 3);
  assert.equal(config.jobLeaseSeconds, 300);
});

test('getMessageBrokerConfig never returns an empty broker URL as configured', function () {
  assert.equal(getMessageBrokerConfig({ MESSAGE_BROKER_ENABLED: 'true', MESSAGE_BROKER_URL: '  ' }).url, null);
});
