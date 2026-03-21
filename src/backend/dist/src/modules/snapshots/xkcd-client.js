import { describeFetchFailure } from '../../shared/fetch-error.js';
const XKCD_LATEST_COMIC_URL = 'https://xkcd.com/info.0.json';
const XKCD_SITE_URL = 'https://xkcd.com/';
const XKCD_IMAGE_HOST = 'imgs.xkcd.com';
const MAX_PRIMARY_ATTEMPTS = 2;
export class XkcdClientImpl {
    async getLatestComic() {
        let primaryError = null;
        try {
            return await this.getLatestComicFromJson();
        }
        catch (error) {
            primaryError = asError(error, 'xkcd request failed.');
        }
        try {
            return await this.getLatestComicFromHomepage();
        }
        catch {
            throw primaryError;
        }
    }
    async getLatestComicFromJson() {
        let lastError = null;
        for (let attempt = 1; attempt <= MAX_PRIMARY_ATTEMPTS; attempt += 1) {
            try {
                return await this.fetchLatestComicFromJson();
            }
            catch (error) {
                lastError = asError(error, 'xkcd request failed.');
                if (!shouldRetryPrimaryRequest(lastError, attempt)) {
                    break;
                }
            }
        }
        throw lastError || new Error('xkcd request failed.');
    }
    async fetchLatestComicFromJson() {
        let response;
        try {
            response = await fetch(XKCD_LATEST_COMIC_URL, {
                headers: {
                    'user-agent': 'Morning-Briefing/0.1 (+xkcd widget)'
                }
            });
        }
        catch (error) {
            throw new Error(describeFetchFailure('xkcd request', XKCD_LATEST_COMIC_URL, error));
        }
        if (!response.ok) {
            throw new Error(`xkcd request failed with status ${response.status}.`);
        }
        const payload = await response.json();
        return mapComic(payload);
    }
    async getLatestComicFromHomepage() {
        let response;
        try {
            response = await fetch(XKCD_SITE_URL, {
                headers: {
                    'user-agent': 'Morning-Briefing/0.1 (+xkcd widget)'
                }
            });
        }
        catch (error) {
            throw new Error(describeFetchFailure('xkcd homepage request', XKCD_SITE_URL, error));
        }
        if (!response.ok) {
            throw new Error(`xkcd homepage request failed with status ${response.status}.`);
        }
        const html = await response.text();
        return parseComicFromHomepage(html);
    }
}
function mapComic(payload) {
    const comicId = typeof payload.num === 'number' ? payload.num : 0;
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const altText = typeof payload.alt === 'string' ? payload.alt.trim() : '';
    const imageUrl = normalizeImageUrl(payload.img);
    const publishedAt = normalizePublishedAt(payload.year, payload.month, payload.day);
    if (!comicId || !title || !altText || !imageUrl) {
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
function parseComicFromHomepage(html) {
    const title = cleanHtmlText(matchFirstGroup(html, /<div id="ctitle">([\s\S]*?)<\/div>/i));
    const comicId = extractComicId(matchFirstGroup(html, /Permanent link to this comic:\s*<a[^>]+href="https:\/\/xkcd\.com\/(\d+)\/?"/i));
    const permalink = normalizePageUrl(matchFirstGroup(html, /Permanent link to this comic:\s*<a[^>]+href="([^"]+)"/i));
    const imageUrl = normalizeImageUrl(matchFirstGroup(html, /<div id="comic">[\s\S]*?<img[^>]+src="([^"]+)"/i), XKCD_SITE_URL);
    const altText = decodeHtmlEntities(matchFirstGroup(html, /<div id="comic">[\s\S]*?<img[^>]+title="([^"]+)"/i)).trim();
    if (!title || !comicId || !permalink || !imageUrl || !altText) {
        throw new Error('xkcd homepage response was incomplete.');
    }
    return {
        id: comicId,
        title,
        altText,
        imageUrl,
        permalink,
        publishedAt: ''
    };
}
function normalizeImageUrl(value, baseUrl) {
    if (typeof value !== 'string' || !value.trim()) {
        return '';
    }
    let url;
    try {
        url = new URL(value, baseUrl || XKCD_SITE_URL);
    }
    catch {
        return '';
    }
    if (url.protocol !== 'https:' || url.hostname !== XKCD_IMAGE_HOST) {
        return '';
    }
    return url.toString();
}
function normalizePublishedAt(year, month, day) {
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
function normalizeDatePart(value) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value !== 'string' || !value.trim()) {
        return 0;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
function shouldRetryPrimaryRequest(error, attempt) {
    if (attempt >= MAX_PRIMARY_ATTEMPTS) {
        return false;
    }
    return /status 5\d{2}\./.test(error.message) || /status 5\d{2}$/.test(error.message) || /failed before receiving a response/i.test(error.message);
}
function asError(error, fallbackMessage) {
    return error instanceof Error ? error : new Error(fallbackMessage);
}
function matchFirstGroup(value, pattern) {
    const match = value.match(pattern);
    return match ? match[1] || '' : '';
}
function cleanHtmlText(value) {
    return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
function normalizePageUrl(value) {
    if (!value) {
        return '';
    }
    try {
        return new URL(value, XKCD_SITE_URL).toString();
    }
    catch {
        return '';
    }
}
function extractComicId(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
function decodeHtmlEntities(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&#x27;/gi, '\'');
}
