import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerReferenceCityRoutes } from './reference-city-routes.js';

test('GET /api/v1/reference/cities returns matching cities', async function () {
  const app = Fastify();

  await registerReferenceCityRoutes(app, {
    referenceCityService: {
      async search(query: string) {
        assert.equal(query, 'par');

        return [
          {
            id: 'city-1',
            geonameId: 2988507,
            name: 'Paris',
            countryCode: 'FR',
            adminName1: 'Ile-de-France',
            timezone: 'Europe/Paris',
            latitude: 48.85341,
            longitude: 2.3488,
            displayName: 'Paris, FR'
          }
        ];
      }
    }
  });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/reference/cities?q=par'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      items: [
        {
          id: 'city-1',
          geonameId: 2988507,
          name: 'Paris',
          countryCode: 'FR',
          adminName1: 'Ile-de-France',
          timezone: 'Europe/Paris',
          latitude: 48.85341,
          longitude: 2.3488,
          displayName: 'Paris, FR'
        }
      ]
    });
  } finally {
    await app.close();
  }
});
