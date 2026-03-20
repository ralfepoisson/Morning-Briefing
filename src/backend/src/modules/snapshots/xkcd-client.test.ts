import test from 'node:test';
import assert from 'node:assert/strict';
import { XkcdClientImpl } from './xkcd-client.js';

test('XkcdClientImpl reads the latest comic from xkcd info.0.json', async function () {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function fetchStub() {
    return new Response(JSON.stringify({
      num: 3221,
      title: 'Landscape Features',
      alt: 'Alt text',
      img: 'https://imgs.xkcd.com/comics/landscape_features.png',
      year: '2026',
      month: '3',
      day: '20'
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }
    });
  };

  try {
    const client = new XkcdClientImpl();
    const comic = await client.getLatestComic();

    assert.deepEqual(comic, {
      id: 3221,
      title: 'Landscape Features',
      altText: 'Alt text',
      imageUrl: 'https://imgs.xkcd.com/comics/landscape_features.png',
      permalink: 'https://xkcd.com/3221/',
      publishedAt: '2026-03-20'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('XkcdClientImpl rejects unexpected image hosts', async function () {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function fetchStub() {
    return new Response(JSON.stringify({
      num: 3221,
      title: 'Landscape Features',
      alt: 'Alt text',
      img: 'https://example.com/comic.png',
      year: '2026',
      month: '3',
      day: '20'
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }
    });
  };

  try {
    const client = new XkcdClientImpl();

    await assert.rejects(async function shouldReject() {
      await client.getLatestComic();
    }, {
      message: 'xkcd response was incomplete.'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
