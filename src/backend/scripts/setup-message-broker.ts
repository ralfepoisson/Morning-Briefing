import 'dotenv/config';
import { getMessageBrokerConfig } from '../src/modules/snapshots/message-broker-config.js';
import { assertRabbitMqTopology, connectRabbitMq } from '../src/modules/snapshots/rabbitmq-connection.js';

const config = getMessageBrokerConfig();
if (!config.enabled || !config.url) {
  throw new Error('MESSAGE_BROKER_ENABLED=true and MESSAGE_BROKER_URL are required.');
}
const model = await connectRabbitMq(config);
const channel = await model.createChannel();
const topology = await assertRabbitMqTopology(channel, config);

console.log(JSON.stringify({
  event: 'message_broker_setup_completed',
  ...topology
}));
await channel.close();
await model.close();
