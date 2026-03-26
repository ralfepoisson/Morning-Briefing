import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './build-app.js';

test('GET /health returns ok', async function () {
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      status: 'ok'
    });
  } finally {
    await app.close();
  }
});

test('buildApp registers dashboard archive route', async function () {
  const app = await buildApp();

  try {
    const routes = app.printRoutes();

    assert.match(routes, /dashboard[\s\S]*s[\s\S]*:dashboardId \(PATCH, DELETE\)/);
  } finally {
    await app.close();
  }
});

test('protected api routes reject requests without an authorization header', async function () {
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboards'
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      message: 'Authorization header is required.'
    });
  } finally {
    await app.close();
  }
});

test('protected api routes allow CORS preflight requests without an authorization header', async function () {
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/dashboards',
      headers: {
        origin: 'http://localhost:8080',
        'access-control-request-method': 'POST'
      }
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:8080');
  } finally {
    await app.close();
  }
});

test('gmail oauth callback is not blocked by api authentication', async function () {
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/connections/gmail/oauth/callback?state=bad-state'
    });

    assert.notEqual(response.statusCode, 401);
  } finally {
    await app.close();
  }
});

test('connection preflight requests allow authorization and content-type headers', async function () {
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/connections',
      headers: {
        origin: 'http://127.0.0.1:8080',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type'
      }
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'http://127.0.0.1:8080');
    assert.equal(response.headers['access-control-allow-headers'], 'Authorization, Content-Type');
  } finally {
    await app.close();
  }
});
