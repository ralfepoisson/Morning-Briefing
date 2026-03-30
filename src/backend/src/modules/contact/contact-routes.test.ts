import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerContactRoutes } from './contact-routes.js';

test('POST /api/v1/public/contact validates and dispatches a contact message', async function () {
  const app = Fastify();
  const sentMessages: Array<Record<string, string>> = [];

  await registerContactRoutes(app, {
    contactMessageService: {
      async sendMessage(input) {
        sentMessages.push(input);
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/public/contact',
      payload: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Interested in Daily Briefing',
        message: 'I would like to learn more about the product.'
      }
    });

    assert.equal(response.statusCode, 202);
    assert.deepEqual(response.json(), {
      message: 'Your message has been sent.'
    });
    assert.deepEqual(sentMessages, [
      {
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Interested in Daily Briefing',
        message: 'I would like to learn more about the product.'
      }
    ]);
  } finally {
    await app.close();
  }
});

test('POST /api/v1/public/contact rejects invalid contact payloads', async function () {
  const app = Fastify();

  await registerContactRoutes(app, {
    contactMessageService: {
      async sendMessage() {
        assert.fail('sendMessage should not be called for invalid payloads');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/public/contact',
      payload: {
        name: 'A',
        email: 'not-an-email',
        subject: '',
        message: 'short'
      }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      message: 'Please provide a valid name, email, subject, and message.'
    });
  } finally {
    await app.close();
  }
});
