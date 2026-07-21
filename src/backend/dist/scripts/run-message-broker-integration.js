import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrismaClient } from '../src/infrastructure/prisma/prisma-client.js';
import { getMessageBrokerConfig } from '../src/modules/snapshots/message-broker-config.js';
import { assertRabbitMqTopology, checkRabbitMqReadiness, connectRabbitMq } from '../src/modules/snapshots/rabbitmq-connection.js';
import { RabbitMqJobPublisher } from '../src/modules/snapshots/rabbitmq-job-publisher.js';
import { createQueueJobProcessor } from '../src/modules/snapshots/snapshot-runtime.js';
import { handleRabbitMqDelivery } from '../src/modules/snapshots/rabbitmq-worker.js';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const DASHBOARD_ID = '33333333-3333-4333-8333-333333333333';
const WIDGET_ID = '44444444-4444-4444-8444-444444444444';
const CONFIG_HASH = 'rabbitmq-integration-config-v1';
const SNAPSHOT_DATE = '2026-07-21';
const phase = process.argv[2];
const scenario = process.argv[3] || 'durability';
const config = getMessageBrokerConfig(process.env);
assert.equal(config.enabled, true, 'MESSAGE_BROKER_ENABLED must be true for integration tests');
assert.ok(config.url, 'MESSAGE_BROKER_URL must be configured for integration tests');
try {
    switch (phase) {
        case 'prepare-durability':
            await prepareDurability();
            break;
        case 'verify-durability':
            await verifyDurability();
            break;
        case 'duplicate':
            await verifyDuplicateIdempotency();
            break;
        case 'redelivery':
            await verifyUnackedRedelivery();
            break;
        case 'publish':
            await publishScenario(scenario);
            break;
        case 'handle-one':
            await handleOne();
            break;
        case 'recover':
            await recoverScenario(scenario);
            break;
        case 'assert-dlq':
            await assertDeadLetter(scenario);
            break;
        case 'malformed':
            await verifyMalformedDeadLetter();
            break;
        case 'readiness':
            await verifyReadiness();
            break;
        default:
            throw new Error(`Unknown message-broker integration phase: ${phase || '<missing>'}`);
    }
}
finally {
    await getPrismaClient().$disconnect().catch(function ignoreDisconnectFailure() { });
}
async function prepareDurability() {
    await seedFixture();
    const { connection, channel } = await openChannel();
    try {
        await Promise.all([
            channel.purgeQueue(config.queue),
            channel.purgeQueue(config.retryQueue),
            channel.purgeQueue(config.dlq)
        ]);
        await publish(channel, envelopeFor('durability'));
        const queue = await channel.checkQueue(config.queue);
        assert.equal(queue.messageCount, 1, 'confirmed durable message was not stored in the main queue');
    }
    finally {
        await channel.close();
        await connection.close();
    }
    console.log('ok - confirmed persistent message prepared for broker restart');
}
async function verifyDurability() {
    const { connection, channel } = await openChannel();
    try {
        const message = await waitForMessage(channel, config.queue);
        assert.equal(parseScenario(message), 'durability');
        await handleRabbitMqDelivery(channel, message, createQueueJobProcessor(), deliveryConfig());
        await assertCompleted('durability', 1, 0);
    }
    finally {
        await channel.close();
        await connection.close();
    }
    console.log('ok - persistent message survived RabbitMQ container recreation and was processed');
}
async function verifyDuplicateIdempotency() {
    const { connection, channel } = await openChannel();
    try {
        const envelope = envelopeFor('duplicate');
        await publish(channel, envelope);
        await publish(channel, envelope);
        const processor = createQueueJobProcessor();
        await handleRabbitMqDelivery(channel, await waitForMessage(channel, config.queue), processor, deliveryConfig());
        await handleRabbitMqDelivery(channel, await waitForMessage(channel, config.queue), processor, deliveryConfig());
        await assertCompleted('duplicate', 1, 1);
    }
    finally {
        await channel.close();
        await connection.close();
    }
    console.log('ok - duplicate broker deliveries produce one PostgreSQL job and one duplicate skip');
}
async function verifyUnackedRedelivery() {
    const first = await openChannel();
    await publish(first.channel, envelopeFor('redelivery'));
    const original = await waitForMessage(first.channel, config.queue);
    await createQueueJobProcessor().process(toProcessorMessage(original));
    await first.connection.close();
    const second = await openChannel();
    try {
        const redelivery = await waitForMessage(second.channel, config.queue);
        assert.equal(redelivery.fields.redelivered, true, 'RabbitMQ did not mark the unacknowledged delivery as redelivered');
        await handleRabbitMqDelivery(second.channel, redelivery, createQueueJobProcessor(), deliveryConfig());
        await assertCompleted('redelivery', 1, 1);
    }
    finally {
        await second.channel.close();
        await second.connection.close();
    }
    console.log('ok - closing a consumer before ack causes safe at-least-once redelivery');
}
async function publishScenario(name) {
    const { connection, channel } = await openChannel();
    try {
        await publish(channel, envelopeFor(name));
    }
    finally {
        await channel.close();
        await connection.close();
    }
    console.log(`ok - published ${name}`);
}
async function handleOne() {
    const { connection, channel } = await openChannel();
    try {
        const message = await waitForMessage(channel, config.queue, 15_000);
        await handleRabbitMqDelivery(channel, message, createQueueJobProcessor(), deliveryConfig());
    }
    finally {
        await channel.close();
        await connection.close();
    }
    console.log('ok - handled one real RabbitMQ delivery');
}
async function recoverScenario(name) {
    await handleOne();
    await assertCompleted(name, 1, 0);
    console.log(`ok - ${name} recovered after a real PostgreSQL connectivity failure`);
}
async function assertDeadLetter(name) {
    const { connection, channel } = await openChannel();
    try {
        const message = await waitForMessage(channel, config.dlq, 15_000);
        assert.equal(parseScenario(message), name);
        channel.ack(message);
    }
    finally {
        await channel.close();
        await connection.close();
    }
    console.log(`ok - ${name} reached the terminal dead-letter queue`);
}
async function verifyMalformedDeadLetter() {
    const { connection, channel } = await openChannel();
    try {
        const malformedId = `malformed-${randomUUID()}`;
        await publish(channel, { type: 'UnexpectedIntegrationMessage', payload: { scenario: 'malformed' } }, malformedId);
        await handleRabbitMqDelivery(channel, await waitForMessage(channel, config.queue), createQueueJobProcessor(), deliveryConfig());
        const dead = await waitForMessage(channel, config.dlq);
        assert.equal(dead.properties.messageId, malformedId);
        assert.equal(parseScenario(dead), 'malformed');
        channel.ack(dead);
    }
    finally {
        await channel.close();
        await connection.close();
    }
    console.log('ok - malformed messages bypass retries and reach the terminal dead-letter queue');
}
async function verifyReadiness() {
    await checkRabbitMqReadiness(process.env);
    await assert.rejects(checkRabbitMqReadiness({
        ...process.env,
        MESSAGE_BROKER_URL: 'amqp://integration:integration-only@127.0.0.1:1'
    }), /./, 'broker readiness did not fail closed for an unreachable endpoint');
    console.log('ok - RabbitMQ readiness succeeds when connected and fails closed when unreachable');
}
async function seedFixture() {
    const prisma = getPrismaClient();
    await prisma.tenant.upsert({
        where: { id: TENANT_ID },
        update: {},
        create: { id: TENANT_ID, name: 'RabbitMQ Integration', slug: 'rabbitmq-integration' }
    });
    await prisma.appUser.upsert({
        where: { id: USER_ID },
        update: {},
        create: {
            id: USER_ID,
            tenantId: TENANT_ID,
            email: 'rabbitmq-integration@example.invalid',
            displayName: 'RabbitMQ Integration',
            timezone: 'UTC',
            locale: 'en-GB'
        }
    });
    await prisma.dashboard.upsert({
        where: { id: DASHBOARD_ID },
        update: {},
        create: {
            id: DASHBOARD_ID,
            tenantId: TENANT_ID,
            ownerUserId: USER_ID,
            name: 'RabbitMQ Integration'
        }
    });
    await prisma.dashboardWidget.upsert({
        where: { id: WIDGET_ID },
        update: { configHash: CONFIG_HASH },
        create: {
            id: WIDGET_ID,
            tenantId: TENANT_ID,
            dashboardId: DASHBOARD_ID,
            widgetType: 'integration-static',
            title: 'Integration Static Widget',
            positionX: 0,
            positionY: 0,
            width: 1,
            height: 1,
            refreshMode: 'SNAPSHOT',
            version: 1,
            configJson: {},
            configHash: CONFIG_HASH
        }
    });
}
function envelopeFor(name) {
    const jobId = `integration-${name}`;
    const payload = {
        schemaVersion: 1,
        jobId,
        idempotencyKey: jobId,
        widgetId: WIDGET_ID,
        dashboardId: DASHBOARD_ID,
        tenantId: TENANT_ID,
        userId: USER_ID,
        widgetConfigVersion: 1,
        widgetConfigHash: CONFIG_HASH,
        snapshotDate: SNAPSHOT_DATE,
        snapshotPeriod: 'day',
        triggerSource: 'manual_refresh',
        bypassDuplicateCheck: false,
        correlationId: null,
        causationId: null,
        requestedAt: '2026-07-21T05:00:00.000Z'
    };
    return { type: 'GenerateWidgetSnapshotRequested', payload };
}
async function openChannel() {
    const connection = await connectRabbitMq(config);
    const channel = await connection.createConfirmChannel();
    await assertRabbitMqTopology(channel, config);
    return { connection, channel };
}
async function publish(channel, envelope, messageId) {
    const id = messageId || envelope.payload.jobId;
    await new RabbitMqJobPublisher(channel, {
        exchange: config.exchange,
        mainRoutingKey: config.mainRoutingKey
    }).publish(envelope, id);
}
async function waitForMessage(channel, queue, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    do {
        const message = await channel.get(queue, { noAck: false });
        if (message) {
            return message;
        }
        await new Promise(function wait(resolve) { setTimeout(resolve, 100); });
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for a message on ${queue}.`);
}
function deliveryConfig() {
    return {
        exchange: config.exchange,
        retryRoutingKey: config.retryRoutingKey,
        deadLetterRoutingKey: config.deadLetterRoutingKey,
        retryQueue: config.retryQueue,
        maxAttempts: config.maxAttempts
    };
}
function toProcessorMessage(message) {
    return {
        body: message.content.toString('utf8'),
        messageId: message.properties.messageId,
        receiptHandle: String(message.fields.deliveryTag)
    };
}
function parseScenario(message) {
    const body = JSON.parse(message.content.toString('utf8'));
    if (body.payload?.scenario) {
        return body.payload.scenario;
    }
    return body.payload?.jobId?.replace(/^integration-/, '');
}
async function assertCompleted(name, attemptCount, duplicateSkipCount) {
    const prisma = getPrismaClient();
    const rows = await prisma.snapshotGenerationJob.findMany({
        where: { idempotencyKey: `integration-${name}` }
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'COMPLETED');
    assert.equal(rows[0].attemptCount, attemptCount);
    assert.equal(rows[0].duplicateSkipCount, duplicateSkipCount);
}
