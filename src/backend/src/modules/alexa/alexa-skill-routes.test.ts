import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerAlexaSkillRoutes } from './alexa-skill-routes.js';

test('POST /api/v1/integrations/alexa prompts for account linking when access token is missing', async function () {
  const app = Fastify();

  await registerAlexaSkillRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        throw new Error('not used');
      }
    },
    alexaSkillService: {
      async getDailyBriefing() {
        throw new Error('not used');
      }
    },
    applicationId: null
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/alexa',
      payload: {
        version: '1.0',
        request: {
          type: 'IntentRequest',
          requestId: 'req-1',
          intent: {
            name: 'GetDailyBriefingIntent'
          }
        },
        context: {
          System: {
            application: {
              applicationId: 'amzn1.ask.skill.example'
            },
            user: {}
          }
        }
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().response.card.type, 'LinkAccount');
  } finally {
    await app.close();
  }
});

test('POST /api/v1/integrations/alexa returns the latest daily briefing for a linked account', async function () {
  const app = Fastify();

  await registerAlexaSkillRoutes(app, {
    defaultUserService: {
      async getDefaultUser(request) {
        assert.equal(request && request.headers.authorization, 'Bearer linked-access-token');
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris',
          locale: 'en-GB',
          preferredLanguage: 'en-GB',
          email: 'ralfe@example.com',
          isAdmin: true
        };
      }
    },
    alexaSkillService: {
      async getDailyBriefing(user) {
        assert.equal(user.userId, 'user-1');
        return {
          status: 'ready',
          dashboardId: 'dash-1',
          dashboardName: 'Workday',
          briefingId: 'briefing-1',
          generatedAt: '2026-03-29T05:30:00.000Z',
          scriptText: 'Good morning. Here is your daily briefing.'
        };
      }
    },
    applicationId: 'amzn1.ask.skill.example'
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/alexa',
      payload: {
        version: '1.0',
        request: {
          type: 'IntentRequest',
          requestId: 'req-1',
          intent: {
            name: 'GetDailyBriefingIntent'
          }
        },
        context: {
          System: {
            application: {
              applicationId: 'amzn1.ask.skill.example'
            },
            user: {
              accessToken: 'linked-access-token'
            }
          }
        }
      }
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.json().response.outputSpeech.text, /Good morning\. Here is your daily briefing\./);
    assert.equal(response.json().response.shouldEndSession, true);
  } finally {
    await app.close();
  }
});

test('POST /api/v1/integrations/alexa rejects requests from an unexpected Alexa application id', async function () {
  const app = Fastify();

  await registerAlexaSkillRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        throw new Error('not used');
      }
    },
    alexaSkillService: {
      async getDailyBriefing() {
        throw new Error('not used');
      }
    },
    applicationId: 'amzn1.ask.skill.expected'
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/alexa',
      payload: {
        version: '1.0',
        request: {
          type: 'LaunchRequest',
          requestId: 'req-1'
        },
        context: {
          System: {
            application: {
              applicationId: 'amzn1.ask.skill.other'
            },
            user: {}
          }
        }
      }
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), {
      message: 'Alexa skill application id is not allowed.'
    });
  } finally {
    await app.close();
  }
});
