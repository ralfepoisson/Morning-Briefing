import { describeFetchFailure } from '../../shared/fetch-error.js';

const XKCD_LATEST_COMIC_URL = 'https://xkcd.com/info.0.json';
const XKCD_SITE_URL = 'https://xkcd.com/';
const XKCD_IMAGE_HOST = 'imgs.xkcd.com';

export type XkcdComic = {
  id: number;
  title: string;
  altText: string;
  imageUrl: string;
  permalink: string;
  publishedAt: string;
};

export interface XkcdClient {
  getLatestComic(): Promise<XkcdComic>;
}

export class XkcdClientImpl implements XkcdClient {
  async getLatestComic(): Promise<XkcdComic> {
    let response: Response;

    try {
      response = await fetch(XKCD_LATEST_COMIC_URL, {
        headers: {
          'user-agent': 'Morning-Briefing/0.1 (+xkcd widget)'
        }
      });
    } catch (error) {
      throw new Error(describeFetchFailure('xkcd request', XKCD_LATEST_COMIC_URL, error));
    }

    if (!response.ok) {
      throw new Error(`xkcd request failed with status ${response.status}.`);
    }

    const payload = await response.json() as XkcdLatestComicResponse;
    return mapComic(payload);
  }
}

type XkcdLatestComicResponse = {
  num?: unknown;
  title?: unknown;
  alt?: unknown;
  img?: unknown;
  year?: unknown;
  month?: unknown;
  day?: unknown;
};

function mapComic(payload: XkcdLatestComicResponse): XkcdComic {
  const comicId = typeof payload.num === 'number' ? payload.num : 0;
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const altText = typeof payload.alt === 'string' ? payload.alt.trim() : '';
  const imageUrl = normalizeImageUrl(payload.img);
  const publishedAt = normalizePublishedAt(payload.year, payload.month, payload.day);

  if (!comicId || !title || !altText || !imageUrl || !publishedAt) {
    throw new Error('xkcd response was incomplete.');
  }

  return {
    id: comicId,
    title,
    altText,
    imageUrl,
    permalink: `${XKCD_SITE_URL}${comicId}/`,
    publishedAt
  };
}

function normalizeImageUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return '';
  }

  if (url.protocol !== 'https:' || url.hostname !== XKCD_IMAGE_HOST) {
    return '';
  }

  return url.toString();
}

function normalizePublishedAt(year: unknown, month: unknown, day: unknown): string {
  const yearValue = normalizeDatePart(year);
  const monthValue = normalizeDatePart(month);
  const dayValue = normalizeDatePart(day);

  if (!yearValue || !monthValue || !dayValue) {
    return '';
  }

  const parsed = new Date(Date.UTC(yearValue, monthValue - 1, dayValue));

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeDatePart(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
