import { describeFetchFailure } from '../../shared/fetch-error.js';

export type ParsedRssArticle = {
  title: string;
  url: string;
  summary: string;
  publishedAt: string | null;
  sourceName: string;
};

export interface RssFeedClient {
  fetchFeed(url: string): Promise<{
    sourceName: string;
    items: ParsedRssArticle[];
  }>;
}

export class HttpRssFeedClient implements RssFeedClient {
  async fetchFeed(url: string): Promise<{
    sourceName: string;
    items: ParsedRssArticle[];
  }> {
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          'user-agent': 'Morning-Briefing/0.1 (+RSS fetcher)'
        }
      });
    } catch (error) {
      throw new Error(describeFetchFailure('RSS feed request', url, error));
    }

    if (!response.ok) {
      throw new Error(`RSS feed request failed with status ${response.status}.`);
    }

    const xml = await response.text();
    return parseFeedDocument(xml, url);
  }
}

function parseFeedDocument(xml: string, fallbackUrl: string): {
  sourceName: string;
  items: ParsedRssArticle[];
} {
  const trimmedXml = xml.trim();

  if (/<feed[\s>]/i.test(trimmedXml)) {
    return parseAtomFeed(trimmedXml, fallbackUrl);
  }

  return parseRssFeed(trimmedXml, fallbackUrl);
}

function parseRssFeed(xml: string, fallbackUrl: string) {
  const channelBlock = matchFirst(xml, /<channel\b[^>]*>([\s\S]*?)<\/channel>/i) || xml;
  const sourceName = cleanText(readTagValue(channelBlock, 'title')) || fallbackUrl;
  const items = matchAll(channelBlock, /<item\b[^>]*>([\s\S]*?)<\/item>/gi).map(function mapItem(itemBlock) {
    const title = cleanText(readTagValue(itemBlock, 'title'));
    const url = cleanText(readTagValue(itemBlock, 'link'));
    const summary = cleanText(
      readTagValue(itemBlock, 'description') ||
      readTagValue(itemBlock, 'content:encoded')
    );
    const publishedAt = normalizeDateString(
      cleanText(readTagValue(itemBlock, 'pubDate')) ||
      cleanText(readTagValue(itemBlock, 'dc:date'))
    );

    return {
      title,
      url,
      summary,
      publishedAt,
      sourceName
    };
  }).filter(isValidArticle);

  return {
    sourceName,
    items
  };
}

function parseAtomFeed(xml: string, fallbackUrl: string) {
  const sourceName = cleanText(readTagValue(xml, 'title')) || fallbackUrl;
  const items = matchAll(xml, /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi).map(function mapEntry(entryBlock) {
    const title = cleanText(readTagValue(entryBlock, 'title'));
    const summary = cleanText(
      readTagValue(entryBlock, 'summary') ||
      readTagValue(entryBlock, 'content')
    );
    const publishedAt = normalizeDateString(
      cleanText(readTagValue(entryBlock, 'published')) ||
      cleanText(readTagValue(entryBlock, 'updated'))
    );
    const url = extractAtomLink(entryBlock);

    return {
      title,
      url,
      summary,
      publishedAt,
      sourceName
    };
  }).filter(isValidArticle);

  return {
    sourceName,
    items
  };
}

function extractAtomLink(entryBlock: string): string {
  const linkMatch = entryBlock.match(/<link\b([^>]*)\/?>/i);

  if (!linkMatch) {
    return '';
  }

  const attrs = linkMatch[1] || '';
  const rel = readAttribute(attrs, 'rel');
  const href = readAttribute(attrs, 'href');

  if (href && (!rel || rel === 'alternate')) {
    return cleanText(href);
  }

  return cleanText(href);
}

function readTagValue(xml: string, tagName: string): string {
  const match = xml.match(new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, 'i'));
  return match ? match[1] : '';
}

function readAttribute(attrs: string, attributeName: string): string {
  const match = attrs.match(new RegExp(`${escapeRegExp(attributeName)}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

function matchFirst(value: string, pattern: RegExp): string {
  const match = value.match(pattern);
  return match ? match[1] : '';
}

function matchAll(value: string, pattern: RegExp): string[] {
  return Array.from(value.matchAll(pattern)).map(function mapMatch(match) {
    return match[1] || '';
  });
}

function cleanText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&#x27;/gi, '\'');
}

function normalizeDateString(value: string): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function isValidArticle(article: ParsedRssArticle): boolean {
  return !!(article.title && article.url);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
