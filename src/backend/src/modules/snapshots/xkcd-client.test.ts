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

test('XkcdClientImpl falls back to the homepage when the json endpoint returns 503', async function () {
  const originalFetch = globalThis.fetch;
  var calls = 0;

  globalThis.fetch = async function fetchStub(url) {
    calls += 1;

    if (String(url) === 'https://xkcd.com/info.0.json') {
      return new Response('', {
        status: 503
      });
    }

    return new Response(
      '<html><body>' +
      '<div id="ctitle">Landscape Features</div>' +
      '<div id="comic">' +
      '<img src="//imgs.xkcd.com/comics/landscape_features.png" title="Alt text" alt="Landscape Features" />' +
      '</div>' +
      'Permanent link to this comic: <a href="https://xkcd.com/3221/">https://xkcd.com/3221/</a>' +
      '</body></html>',
      {
        status: 200,
        headers: {
          'content-type': 'text/html'
        }
      }
    );
  };

  try {
    const client = new XkcdClientImpl();
    const comic = await client.getLatestComic();

    assert.equal(calls, 3);
    assert.deepEqual(comic, {
      id: 3221,
      title: 'Landscape Features',
      altText: 'Alt text',
      imageUrl: 'https://imgs.xkcd.com/comics/landscape_features.png',
      permalink: 'https://xkcd.com/3221/',
      publishedAt: ''
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
