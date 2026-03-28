import test from 'node:test';
import assert from 'node:assert/strict';
import { NatGeoDailyPhotoClientImpl } from './natgeo-daily-photo-client.js';

test('NatGeoDailyPhotoClientImpl reads the active photo from the page state payload', async function () {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function fetchStub() {
    return new Response(
      '<html><head><link rel="canonical" href="https://www.nationalgeographic.com/photo-of-the-day/media-spotlight/cherry-blossoms-kyoto-japan" /></head><body>' +
      '<script>window.__PRELOADED_STATE__={"activeItem":{"img":{"src":"https://i.natgeofe.com/n/ed73dbf1-1675-4a96-ba31-91f2f1f71649/-19-MM9908__220401_000403.jpg","altText":"People walking over a bridge in front of blooming pink cherry blossoms.","crdt":"Rinko Kawauchi, National Geographic Image Collection","dsc":"Passersby walk over a bridge framed by cherry blossoms in full bloom in Arashiyama, Kyoto. Known in the country as sakura.","ttl":"Kyoto in Bloom"},"caption":{"credit":"Rinko Kawauchi, National Geographic Image Collection","text":"Passersby walk over a bridge framed by cherry blossoms in full bloom in Arashiyama, Kyoto. Known in the country as sakura.","title":"Kyoto in Bloom"}},"config":{}};</script>' +
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
    const client = new NatGeoDailyPhotoClientImpl();
    const photo = await client.getDailyPhoto();

    assert.deepEqual(photo, {
      title: 'Kyoto in Bloom',
      description: 'Passersby walk over a bridge framed by cherry blossoms in full bloom in Arashiyama, Kyoto.',
      imageUrl: 'https://i.natgeofe.com/n/ed73dbf1-1675-4a96-ba31-91f2f1f71649/-19-MM9908__220401_000403.jpg',
      altText: 'People walking over a bridge in front of blooming pink cherry blossoms.',
      permalink: 'https://www.nationalgeographic.com/photo-of-the-day/media-spotlight/cherry-blossoms-kyoto-japan',
      credit: 'Rinko Kawauchi, National Geographic Image Collection'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('NatGeoDailyPhotoClientImpl falls back to page metadata when the active item payload is absent', async function () {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function fetchStub() {
    return new Response(
      '<html><head>' +
      '<title>Kyoto in Bloom | Nat Geo Photo of the Day | National Geographic</title>' +
      '<link rel="canonical" href="https://www.nationalgeographic.com/photo-of-the-day/media-spotlight/cherry-blossoms-kyoto-japan" />' +
      '<meta property="og:image" content="https://i.natgeofe.com/n/ed73dbf1-1675-4a96-ba31-91f2f1f71649/-19-MM9908__220401_000403.jpg" />' +
      '<meta name="description" content="Passersby walk over a bridge framed by cherry blossoms in full bloom in Arashiyama, Kyoto. Known in the country as sakura." />' +
      '<meta name="twitter:image:alt" content="People walking over a bridge in front of blooming pink cherry blossoms." />' +
      '</head><body></body></html>',
      {
        status: 200,
        headers: {
          'content-type': 'text/html'
        }
      }
    );
  };

  try {
    const client = new NatGeoDailyPhotoClientImpl();
    const photo = await client.getDailyPhoto();

    assert.deepEqual(photo, {
      title: 'Kyoto in Bloom',
      description: 'Passersby walk over a bridge framed by cherry blossoms in full bloom in Arashiyama, Kyoto.',
      imageUrl: 'https://i.natgeofe.com/n/ed73dbf1-1675-4a96-ba31-91f2f1f71649/-19-MM9908__220401_000403.jpg',
      altText: 'People walking over a bridge in front of blooming pink cherry blossoms.',
      permalink: 'https://www.nationalgeographic.com/photo-of-the-day/media-spotlight/cherry-blossoms-kyoto-japan',
      credit: ''
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('NatGeoDailyPhotoClientImpl rejects unexpected image hosts', async function () {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function fetchStub() {
    return new Response(
      '<html><body><script>window.__PRELOADED_STATE__={"activeItem":{"img":{"src":"https://example.com/photo.jpg","dsc":"A photo. More text.","ttl":"Sample"}},"config":{}};</script></body></html>',
      {
        status: 200,
        headers: {
          'content-type': 'text/html'
        }
      }
    );
  };

  try {
    const client = new NatGeoDailyPhotoClientImpl();

    await assert.rejects(async function shouldReject() {
      await client.getDailyPhoto();
    }, {
      message: 'NatGeo Daily Photo response was incomplete.'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
