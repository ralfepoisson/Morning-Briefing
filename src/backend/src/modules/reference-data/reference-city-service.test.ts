import test from 'node:test';
import assert from 'node:assert/strict';
import { ReferenceCityService } from './reference-city-service.js';
import type { ReferenceCityRepository } from './reference-city-repository.js';

test('ReferenceCityService returns empty results for a blank query', async function () {
  const repository: ReferenceCityRepository = {
    async search() {
      throw new Error('not used');
    }
  };
  const service = new ReferenceCityService(repository);

  const cities = await service.search('   ');

  assert.deepEqual(cities, []);
});

test('ReferenceCityService maps city search results for the API', async function () {
  const repository: ReferenceCityRepository = {
    async search(query: string, limit: number) {
      assert.equal(query, 'par');
      assert.equal(limit, 12);

      return [
        {
          id: 'city-1',
          geonameId: 2988507,
          name: 'Paris',
          asciiName: 'Paris',
          countryCode: 'FR',
          adminName1: 'Ile-de-France',
          timezone: 'Europe/Paris',
          latitude: 48.85341,
          longitude: 2.3488
        }
      ];
    }
  };
  const service = new ReferenceCityService(repository);

  const cities = await service.search('par');

  assert.deepEqual(cities, [
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
  ]);
});
