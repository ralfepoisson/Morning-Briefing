import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleCalendarClientImpl } from './google-calendar-client.js';

test('GoogleCalendarClientImpl maps events into snapshot-friendly items', async function () {
  const originalFetch = globalThis.fetch;
  const client = new GoogleCalendarClientImpl();

  globalThis.fetch = async function mockFetch(input, init) {
    const url = input instanceof URL ? input : new URL(String(input));

    assert.equal(url.searchParams.get('singleEvents'), 'true');
    assert.equal(url.searchParams.get('orderBy'), 'startTime');
    assert.equal(init && init.headers && (init.headers as Record<string, string>).Authorization, 'Bearer secret-token');

    return new Response(JSON.stringify({
      items: [
        {
          id: 'event-1',
          summary: 'Stand-up',
          location: 'Teams',
          htmlLink: 'https://calendar.google.com/event?eid=1',
          start: {
            dateTime: '2026-03-20T09:00:00+01:00'
          }
        },
        {
          id: 'event-2',
          summary: 'Company offsite',
          start: {
            date: '2026-03-20'
          }
        }
      ]
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }
    });
  } as typeof fetch;

  try {
    const events = await client.listEvents('secret-token', 'team@example.com', new Date('2026-03-20T08:00:00.000Z'));

    assert.deepEqual(events, [
      {
        id: 'event-1',
        title: 'Stand-up',
        location: 'Teams',
        url: 'https://calendar.google.com/event?eid=1',
        isAllDay: false,
        timeLabel: '09:00'
      },
      {
        id: 'event-2',
        title: 'Company offsite',
        location: '',
        url: '',
        isAllDay: true,
        timeLabel: 'All day'
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GoogleCalendarClientImpl throws when the provider returns an error', async function () {
  const originalFetch = globalThis.fetch;
  const client = new GoogleCalendarClientImpl();

  globalThis.fetch = async function mockFetch() {
    return new Response('forbidden', {
      status: 403
    });
  } as typeof fetch;

  try {
    await assert.rejects(
      function () {
        return client.listEvents('secret-token', 'team@example.com', new Date('2026-03-20T08:00:00.000Z'));
      },
      {
        message: 'Google Calendar request failed with status 403.'
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GoogleCalendarClientImpl includes network failure details when fetch throws', async function () {
  const originalFetch = globalThis.fetch;
  const client = new GoogleCalendarClientImpl();

  globalThis.fetch = async function mockFetch() {
    const cause = new Error('getaddrinfo ENOTFOUND www.googleapis.com');
    (cause as Error & { code?: string }).code = 'ENOTFOUND';

    const error = new TypeError('fetch failed') as TypeError & { cause?: unknown };
    error.cause = cause;
    throw error;
  } as typeof fetch;

  try {
    await assert.rejects(
      function () {
        return client.listEvents('secret-token', 'team@example.com', new Date('2026-03-20T08:00:00.000Z'));
      },
      {
        message: 'Google Calendar request failed before receiving a response from https://www.googleapis.com: ENOTFOUND getaddrinfo ENOTFOUND www.googleapis.com.'
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
