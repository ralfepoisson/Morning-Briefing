import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerConnectionRoutes } from './connection-routes.js';
import type { ConnectionResponse } from './connection-types.js';
import type { GmailOAuthClient } from './gmail-oauth-client.js';
import type { GoogleCalendarOAuthClient } from './google-calendar-oauth-client.js';

test('GET /api/v1/connections returns available connections', async function () {
  const app = Fastify();
  const expectedConnections: ConnectionResponse[] = [
    {
      id: 'connection-1',
      type: 'todoist',
      name: 'Todoist',
      status: 'ACTIVE',
      authType: 'API_KEY',
      createdAt: '2026-03-19T08:00:00.000Z',
      updatedAt: '2026-03-19T08:00:00.000Z'
    }
  ];

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    connectionService: {
      async listForTenant(tenantId, type) {
        assert.equal(tenantId, 'tenant-1');
        assert.equal(type, 'todoist');
        return expectedConnections;
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      }
    },
    googleCalendarOAuthClient: createGoogleCalendarOAuthClientStub()
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/connections?type=todoist'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      items: expectedConnections
    });
  } finally {
    await app.close();
  }
});

test('POST /api/v1/connections creates a Todoist connection', async function () {
  const app = Fastify();

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    connectionService: {
      async listForTenant() {
        throw new Error('not used');
      },
      async create(input) {
        assert.equal(input.tenantId, 'tenant-1');
        assert.equal(input.type, 'todoist');
        assert.deepEqual(input.credentials, {
          apiKey: 'secret-token'
        });

        return {
          id: 'connection-1',
          type: 'todoist',
          name: 'Todoist',
          status: 'ACTIVE',
          authType: 'API_KEY',
          createdAt: '2026-03-19T08:00:00.000Z',
          updatedAt: '2026-03-19T08:00:00.000Z'
        };
      },
      async update() {
        throw new Error('not used');
      }
    },
    googleCalendarOAuthClient: createGoogleCalendarOAuthClientStub()
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/connections',
      payload: {
        type: 'todoist',
        credentials: {
          apiKey: 'secret-token'
        }
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().type, 'todoist');
  } finally {
    await app.close();
  }
});

test('GET /api/v1/connections/google-calendar/oauth/start redirects to Google', async function () {
  const app = Fastify();
  let capturedState = '';

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    connectionService: {
      async listForTenant() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      },
    },
    googleCalendarOAuthClient: {
      ...createGoogleCalendarOAuthClientStub(),
      createAuthorizationUrl(state) {
        capturedState = JSON.stringify(state);
        return 'https://accounts.google.com/o/oauth2/v2/auth?state=signed';
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/connections/google-calendar/oauth/start?returnTo=' + encodeURIComponent('http://127.0.0.1:8080/#/')
    });

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, 'https://accounts.google.com/o/oauth2/v2/auth?state=signed');
    assert.match(capturedState, /tenant-1/);
  } finally {
    await app.close();
  }
});

test('POST /api/v1/connections/google-calendar/oauth/start returns a Google authorization url', async function () {
  const app = Fastify();
  let capturedState = '';

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    connectionService: {
      async listForTenant() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      }
    },
    googleCalendarOAuthClient: {
      ...createGoogleCalendarOAuthClientStub(),
      createAuthorizationUrl(state) {
        capturedState = JSON.stringify(state);
        return 'https://accounts.google.com/o/oauth2/v2/auth?state=signed';
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/connections/google-calendar/oauth/start',
      payload: {
        returnTo: 'https://briefing.ralfepoisson.com/#/admin/connectors',
        connectionId: 'connection-1'
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed'
    });
    assert.match(capturedState, /connection-1/);
    assert.match(capturedState, /tenant-1/);
  } finally {
    await app.close();
  }
});

test('GET /api/v1/connections/google-calendar/oauth/callback creates a connection and redirects back', async function () {
  const app = Fastify();
  let created = false;

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    connectionService: {
      async listForTenant() {
        throw new Error('not used');
      },
      async create(input) {
        created = true;
        assert.equal(input.tenantId, 'tenant-1');
        assert.equal(input.type, 'google-calendar');
        assert.equal(input.credentials.refreshToken, 'refresh-token');
        assert.equal(input.credentials.calendarId, 'primary@example.com');

        return {
          id: 'connection-2',
          type: 'google-calendar',
          name: 'Primary Calendar',
          status: 'ACTIVE',
          authType: 'OAUTH',
          config: {
            calendarId: 'primary@example.com'
          },
          createdAt: '2026-03-19T08:00:00.000Z',
          updatedAt: '2026-03-19T08:00:00.000Z'
        };
      },
      async update() {
        throw new Error('not used');
      }
    },
    googleCalendarOAuthClient: {
      ...createGoogleCalendarOAuthClientStub(),
      verifyState() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          returnTo: 'http://127.0.0.1:8080/#/',
          issuedAt: Date.now()
        };
      },
      async exchangeAuthorizationCode(code) {
        assert.equal(code, 'auth-code');

        return {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: '2026-03-20T10:00:00.000Z',
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          tokenType: 'Bearer'
        };
      },
      async getPrimaryCalendar(accessToken) {
        assert.equal(accessToken, 'access-token');

        return {
          calendarId: 'primary@example.com',
          accountEmail: 'primary@example.com',
          accountLabel: 'Primary Calendar',
          timezone: 'Europe/Paris'
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/connections/google-calendar/oauth/callback?code=auth-code&state=signed-state'
    });

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, 'http://127.0.0.1:8080/#/?oauthConnectionId=connection-2&oauthProvider=google-calendar');
    assert.equal(created, true);
  } finally {
    await app.close();
  }
});

test('GET /api/v1/connections/google-calendar/oauth/callback saves the connection without resolving the current request user', async function () {
  const app = Fastify();
  let created = false;

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        throw new Error('callback should rely on OAuth state');
      }
    },
    connectionService: {
      async listForTenant() {
        throw new Error('not used');
      },
      async create(input) {
        created = true;
        assert.equal(input.tenantId, 'tenant-1');
        assert.equal(input.type, 'google-calendar');
        assert.equal(input.credentials.refreshToken, 'refresh-token');

        return {
          id: 'connection-2',
          type: 'google-calendar',
          name: 'Primary Calendar',
          status: 'ACTIVE',
          authType: 'OAUTH',
          config: {
            calendarId: 'primary@example.com'
          },
          createdAt: '2026-03-19T08:00:00.000Z',
          updatedAt: '2026-03-19T08:00:00.000Z'
        };
      },
      async update() {
        throw new Error('not used');
      }
    },
    googleCalendarOAuthClient: {
      ...createGoogleCalendarOAuthClientStub(),
      verifyState() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          returnTo: 'https://briefing.ralfepoisson.com/#/',
          issuedAt: Date.now()
        };
      },
      async exchangeAuthorizationCode() {
        return {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: '2026-03-20T10:00:00.000Z',
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          tokenType: 'Bearer'
        };
      },
      async getPrimaryCalendar() {
        return {
          calendarId: 'primary@example.com',
          accountEmail: 'primary@example.com',
          accountLabel: 'Primary Calendar',
          timezone: 'Europe/Paris'
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/connections/google-calendar/oauth/callback?code=auth-code&state=signed-state'
    });

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, 'https://briefing.ralfepoisson.com/#/?oauthConnectionId=connection-2&oauthProvider=google-calendar');
    assert.equal(created, true);
  } finally {
    await app.close();
  }
});

test('GET /api/v1/connections/google-calendar/oauth/callback updates an existing connection from OAuth state', async function () {
  const app = Fastify();
  let updated = false;

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        throw new Error('callback should rely on OAuth state');
      }
    },
    connectionService: {
      async listForTenant() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update(input) {
        updated = true;
        assert.equal(input.tenantId, 'tenant-1');
        assert.equal(input.connectionId, 'connection-42');
        assert.equal(input.name, 'Work Calendar');
        assert.equal(input.credentials.refreshToken, 'refresh-token');
        assert.equal(input.credentials.calendarId, 'work@example.com');

        return {
          id: 'connection-42',
          type: 'google-calendar',
          name: 'Work Calendar',
          status: 'ACTIVE',
          authType: 'OAUTH',
          config: {
            calendarId: 'work@example.com'
          },
          createdAt: '2026-03-19T08:00:00.000Z',
          updatedAt: '2026-03-20T08:00:00.000Z'
        };
      }
    },
    googleCalendarOAuthClient: {
      ...createGoogleCalendarOAuthClientStub(),
      verifyState() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          connectionId: 'connection-42',
          returnTo: 'https://briefing.ralfepoisson.com/#/connectors',
          issuedAt: Date.now()
        };
      },
      async exchangeAuthorizationCode() {
        return {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: '2026-03-20T10:00:00.000Z',
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          tokenType: 'Bearer'
        };
      },
      async getPrimaryCalendar() {
        return {
          calendarId: 'work@example.com',
          accountEmail: 'work@example.com',
          accountLabel: 'Work Calendar',
          timezone: 'Europe/Paris'
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/connections/google-calendar/oauth/callback?code=auth-code&state=signed-state'
    });

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, 'https://briefing.ralfepoisson.com/#/connectors?oauthConnectionId=connection-42&oauthProvider=google-calendar');
    assert.equal(updated, true);
  } finally {
    await app.close();
  }
});

test('GET /api/v1/connections/google-calendar/oauth/callback redirects back safely when state verification fails', async function () {
  const app = Fastify();
  let createCalls = 0;
  let updateCalls = 0;

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        throw new Error('not used');
      }
    },
    connectionService: {
      async listForTenant() {
        throw new Error('not used');
      },
      async create() {
        createCalls += 1;
        throw new Error('not used');
      },
      async update() {
        updateCalls += 1;
        throw new Error('not used');
      }
    },
    googleCalendarOAuthClient: {
      ...createGoogleCalendarOAuthClientStub(),
      verifyState() {
        throw new Error('Google OAuth state is invalid.');
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/connections/google-calendar/oauth/callback?code=auth-code&state=bad-state'
    });

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, 'http://127.0.0.1:8080/#/');
    assert.equal(createCalls, 0);
    assert.equal(updateCalls, 0);
  } finally {
    await app.close();
  }
});

test('POST /api/v1/connections/gmail/oauth/start returns a Google authorization url', async function () {
  const app = Fastify();
  let capturedState = '';

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    connectionService: {
      async listForTenant() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      }
    },
    googleCalendarOAuthClient: createGoogleCalendarOAuthClientStub(),
    gmailOAuthClient: {
      ...createGmailOAuthClientStub(),
      createAuthorizationUrl(state) {
        capturedState = JSON.stringify(state);
        return 'https://accounts.google.com/o/oauth2/v2/auth?state=gmail-signed';
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/connections/gmail/oauth/start',
      payload: {
        returnTo: 'https://briefing.ralfepoisson.com/#/',
        connectionId: 'connection-gmail-1'
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=gmail-signed'
    });
    assert.match(capturedState, /connection-gmail-1/);
    assert.match(capturedState, /tenant-1/);
  } finally {
    await app.close();
  }
});

test('GET /api/v1/connections/gmail/oauth/callback creates a connection and redirects back', async function () {
  const app = Fastify();
  let created = false;

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        throw new Error('callback should rely on OAuth state');
      }
    },
    connectionService: {
      async listForTenant() {
        throw new Error('not used');
      },
      async create(input) {
        created = true;
        assert.equal(input.tenantId, 'tenant-1');
        assert.equal(input.type, 'gmail');
        assert.equal(input.credentials.refreshToken, 'refresh-token');
        assert.equal(input.credentials.accountEmail, 'ralf@example.com');

        return {
          id: 'connection-gmail-2',
          type: 'gmail',
          name: 'ralf@example.com',
          status: 'ACTIVE',
          authType: 'OAUTH',
          config: {
            accountEmail: 'ralf@example.com'
          },
          createdAt: '2026-03-19T08:00:00.000Z',
          updatedAt: '2026-03-19T08:00:00.000Z'
        };
      },
      async update() {
        throw new Error('not used');
      }
    },
    googleCalendarOAuthClient: createGoogleCalendarOAuthClientStub(),
    gmailOAuthClient: {
      ...createGmailOAuthClientStub(),
      verifyState() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          returnTo: 'http://127.0.0.1:8080/#/',
          issuedAt: Date.now()
        };
      },
      async exchangeAuthorizationCode(code) {
        assert.equal(code, 'auth-code');

        return {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: '2026-03-20T10:00:00.000Z',
          scope: 'https://www.googleapis.com/auth/gmail.readonly',
          tokenType: 'Bearer'
        };
      },
      async getAccount(accessToken) {
        assert.equal(accessToken, 'access-token');

        return {
          accountEmail: 'ralf@example.com',
          accountLabel: 'ralf@example.com'
        };
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/connections/gmail/oauth/callback?code=auth-code&state=signed-state'
    });

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, 'http://127.0.0.1:8080/#/?oauthConnectionId=connection-gmail-2&oauthProvider=gmail');
    assert.equal(created, true);
  } finally {
    await app.close();
  }
});

test('PATCH /api/v1/connections/:connectionId updates a Todoist connection', async function () {
  const app = Fastify();

  await registerConnectionRoutes(app, {
    defaultUserService: {
      async getDefaultUser() {
        return {
          tenantId: 'tenant-1',
          userId: 'user-1',
          displayName: 'Ralfe',
          timezone: 'Europe/Paris'
        };
      }
    },
    connectionService: {
      async listForTenant() {
        throw new Error('not used');
      },
      async create() {
        throw new Error('not used');
      },
      async update(input) {
        assert.equal(input.tenantId, 'tenant-1');
        assert.equal(input.connectionId, 'connection-1');
        assert.equal(input.name, 'Todoist');
        assert.deepEqual(input.credentials, {
          apiKey: 'updated-secret-token'
        });

        return {
          id: 'connection-1',
          type: 'todoist',
          name: 'Todoist',
          status: 'ACTIVE',
          authType: 'API_KEY',
          createdAt: '2026-03-19T08:00:00.000Z',
          updatedAt: '2026-03-20T08:00:00.000Z'
        };
      }
    },
    googleCalendarOAuthClient: createGoogleCalendarOAuthClientStub()
  });

  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/connections/connection-1',
      payload: {
        name: 'Todoist',
        credentials: {
          apiKey: 'updated-secret-token'
        }
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().updatedAt, '2026-03-20T08:00:00.000Z');
  } finally {
    await app.close();
  }
});

function createGoogleCalendarOAuthClientStub(): Pick<
  GoogleCalendarOAuthClient,
  'createAuthorizationUrl' | 'exchangeAuthorizationCode' | 'getPrimaryCalendar' | 'normalizeReturnTo' | 'verifyState'
> {
  return {
    createAuthorizationUrl() {
      return 'https://accounts.google.com/o/oauth2/v2/auth';
    },
    async exchangeAuthorizationCode() {
      throw new Error('not used');
    },
    async getPrimaryCalendar() {
      throw new Error('not used');
    },
    normalizeReturnTo(value) {
      return value || 'http://127.0.0.1:8080/#/';
    },
    verifyState() {
      throw new Error('not used');
    }
  };
}

function createGmailOAuthClientStub(): Pick<
  GmailOAuthClient,
  'createAuthorizationUrl' | 'exchangeAuthorizationCode' | 'getAccount' | 'normalizeReturnTo' | 'verifyState'
> {
  return {
    createAuthorizationUrl() {
      return 'https://accounts.google.com/o/oauth2/v2/auth';
    },
    async exchangeAuthorizationCode() {
      throw new Error('not used');
    },
    async getAccount() {
      throw new Error('not used');
    },
    normalizeReturnTo(value) {
      return value || 'http://127.0.0.1:8080/#/';
    },
    verifyState() {
      throw new Error('not used');
    }
  };
}
