import { describeFetchFailure } from '../../shared/fetch-error.js';
const NATGEO_DAILY_PHOTO_URL = 'https://www.nationalgeographic.com/photo-of-the-day/';
const NATGEO_SITE_HOST = 'www.nationalgeographic.com';
const NATGEO_IMAGE_HOST = 'i.natgeofe.com';
export class NatGeoDailyPhotoClientImpl {
    async getDailyPhoto() {
        let response;
        try {
            response = await fetch(NATGEO_DAILY_PHOTO_URL, {
                headers: {
                    'user-agent': 'Morning-Briefing/0.1 (+NatGeo Daily Photo widget)'
                }
            });
        }
        catch (error) {
            throw new Error(describeFetchFailure('NatGeo Daily Photo request', NATGEO_DAILY_PHOTO_URL, error));
        }
        if (!response.ok) {
            throw new Error(`NatGeo Daily Photo request failed with status ${response.status}.`);
        }
        const html = await response.text();
        return parseDailyPhotoFromPage(html);
    }
}
function parseDailyPhotoFromPage(html) {
    const activeItem = parseActiveItemPayload(html);
    const canonicalUrl = extractCanonicalUrl(html);
    if (activeItem) {
        const fromActiveItem = mapActiveItem(activeItem, canonicalUrl);
        if (fromActiveItem) {
            return fromActiveItem;
        }
    }
    const title = normalizeFallbackTitle(extractMetaContent(html, 'title') || extractTagContent(html, 'title'));
    const description = extractFirstSentence(extractMetaContent(html, 'description'));
    const imageUrl = normalizeImageUrl(extractMetaContent(html, 'og:image'));
    const altText = cleanText(extractMetaContent(html, 'twitter:image:alt'));
    const permalink = normalizePermalink(extractCanonicalUrl(html));
    if (!title || !description || !imageUrl || !permalink) {
        throw new Error('NatGeo Daily Photo response was incomplete.');
    }
    return {
        title,
        description,
        imageUrl,
        altText: altText || title,
        permalink,
        credit: ''
    };
}
function parseActiveItemPayload(html) {
    const objectText = extractJsonObjectAfterMarker(html, '"activeItem":');
    if (!objectText) {
        return null;
    }
    try {
        return JSON.parse(objectText);
    }
    catch {
        return null;
    }
}
function mapActiveItem(payload, canonicalUrl) {
    const title = cleanText(asString(payload.caption && payload.caption.title) || asString(payload.img && payload.img.ttl));
    const description = extractFirstSentence(asString(payload.caption && payload.caption.text) || asString(payload.img && payload.img.dsc));
    const imageUrl = normalizeImageUrl(asString(payload.img && payload.img.src));
    const altText = cleanText(asString(payload.img && payload.img.altText));
    const credit = cleanText(asString(payload.caption && payload.caption.credit) || asString(payload.img && payload.img.crdt));
    const permalink = normalizePermalink(asString(payload.locator) || canonicalUrl);
    if (!title || !description || !imageUrl || !permalink) {
        return null;
    }
    return {
        title,
        description,
        imageUrl,
        altText: altText || title,
        permalink,
        credit
    };
}
function extractJsonObjectAfterMarker(html, marker) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) {
        return '';
    }
    const objectStart = html.indexOf('{', markerIndex + marker.length);
    if (objectStart === -1) {
        return '';
    }
    let depth = 0;
    let isInString = false;
    let isEscaped = false;
    for (let index = objectStart; index < html.length; index += 1) {
        const character = html[index];
        if (isEscaped) {
            isEscaped = false;
            continue;
        }
        if (character === '\\') {
            isEscaped = true;
            continue;
        }
        if (character === '"') {
            isInString = !isInString;
            continue;
        }
        if (isInString) {
            continue;
        }
        if (character === '{') {
            depth += 1;
        }
        else if (character === '}') {
            depth -= 1;
            if (depth === 0) {
                return html.slice(objectStart, index + 1);
            }
        }
    }
    return '';
}
function extractMetaContent(html, name) {
    const escaped = escapeRegex(name);
    const patterns = [
        new RegExp(`<meta[^>]+name="${escaped}"[^>]+content="([^"]*)"`, 'i'),
        new RegExp(`<meta[^>]+property="${escaped}"[^>]+content="([^"]*)"`, 'i'),
        new RegExp(`<meta[^>]+content="([^"]*)"[^>]+name="${escaped}"`, 'i'),
        new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${escaped}"`, 'i')
    ];
    for (const pattern of patterns) {
        const value = matchFirstGroup(html, pattern);
        if (value) {
            return decodeHtmlEntities(value);
        }
    }
    return '';
}
function extractCanonicalUrl(html) {
    return decodeHtmlEntities(matchFirstGroup(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i));
}
function extractTagContent(html, tagName) {
    return decodeHtmlEntities(matchFirstGroup(html, new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i')));
}
function normalizeFallbackTitle(value) {
    const cleaned = cleanText(value);
    if (!cleaned) {
        return '';
    }
    return cleaned
        .replace(/\s*\|\s*Nat Geo Photo of the Day\s*\|\s*National Geographic\s*$/i, '')
        .replace(/\s*\|\s*National Geographic\s*$/i, '')
        .trim();
}
function normalizeImageUrl(value) {
    if (!value.trim()) {
        return '';
    }
    let url;
    try {
        url = new URL(value, NATGEO_DAILY_PHOTO_URL);
    }
    catch {
        return '';
    }
    if (url.protocol !== 'https:' || url.hostname !== NATGEO_IMAGE_HOST) {
        return '';
    }
    return url.toString();
}
function normalizePermalink(value) {
    if (!value.trim()) {
        return '';
    }
    let url;
    try {
        url = new URL(value, NATGEO_DAILY_PHOTO_URL);
    }
    catch {
        return '';
    }
    if (url.protocol !== 'https:' || url.hostname !== NATGEO_SITE_HOST) {
        return '';
    }
    return url.toString();
}
function extractFirstSentence(value) {
    const cleaned = cleanText(value);
    if (!cleaned) {
        return '';
    }
    const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
    return match ? match[1].trim() : cleaned;
}
function cleanText(value) {
    return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
function decodeHtmlEntities(value) {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&apos;/g, '\'')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}
function matchFirstGroup(value, pattern) {
    const match = value.match(pattern);
    return match ? match[1] || '' : '';
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function asString(value) {
    return typeof value === 'string' ? value : '';
}
