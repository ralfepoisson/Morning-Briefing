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

    assert.match(routes, /dashboards[\s\S]*:dashboardId \(PATCH, DELETE\)/);
  } finally {
    await app.close();
  }
});
