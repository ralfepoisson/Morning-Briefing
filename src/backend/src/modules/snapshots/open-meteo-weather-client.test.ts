import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenMeteoWeatherClient } from './open-meteo-weather-client.js';

test('OpenMeteoWeatherClient maps forecast data into widget snapshot content', async function () {
  const originalFetch = globalThis.fetch;
  const client = new OpenMeteoWeatherClient();

  globalThis.fetch = async function mockFetch() {
    return new Response(JSON.stringify({
      current: {
        temperature_2m: 16.4,
        apparent_temperature: 15.2,
        weather_code: 3,
        wind_speed_10m: 18.3
      },
      daily: {
        temperature_2m_max: [20.4],
        temperature_2m_min: [11.2],
        precipitation_probability_max: [35],
        uv_index_max: [4.2]
      }
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }
    });
  } as typeof fetch;

  try {
    const snapshot = await client.getSnapshot({
      latitude: 48.85341,
      longitude: 2.3488,
      timezone: 'Europe/Paris',
      locationLabel: 'Paris, FR'
    });

    assert.deepEqual(snapshot, {
      temperature: '16°',
      condition: 'Overcast',
      location: 'Paris, FR',
      highLow: 'H: 20°  L: 11°',
      summary: 'Latest forecast from Open-Meteo for Paris, FR.',
      details: [
        { label: 'Feels like', value: '15°' },
        { label: 'Rain', value: '35%' },
        { label: 'UV', value: 'Moderate' },
        { label: 'Wind', value: '18 km/h' }
      ]
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenMeteoWeatherClient throws when the provider returns an error', async function () {
  const originalFetch = globalThis.fetch;
  const client = new OpenMeteoWeatherClient();

  globalThis.fetch = async function mockFetch() {
    return new Response('upstream unavailable', {
      status: 502
    });
  } as typeof fetch;

  try {
    await assert.rejects(
      function () {
        return client.getSnapshot({
          latitude: 48.85341,
          longitude: 2.3488,
          timezone: 'Europe/Paris',
          locationLabel: 'Paris, FR'
        });
      },
      {
        message: 'Weather provider request failed.'
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
