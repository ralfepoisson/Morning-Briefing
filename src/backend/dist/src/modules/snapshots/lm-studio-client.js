import { describeFetchFailure } from '../../shared/fetch-error.js';
export class LmStudioNewsSummarizer {
    baseUrl;
    modelName;
    fallbackBaseUrl;
    constructor(env = getProcessEnv()) {
        this.baseUrl = (env.NEWS_LLM_BASE_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');
        this.modelName = env.NEWS_LLM_MODEL || '';
        this.fallbackBaseUrl = 'http://127.0.0.1:1234';
    }
    async summarize(input) {
        const model = await this.resolveModel();
        const response = await this.request('/v1/chat/completions', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model,
                temperature: 0.2,
                messages: buildMessages(input)
            })
        }, 'LM Studio request');
        if (!response.ok) {
            throw new Error(`LM Studio request failed with status ${response.status}.`);
        }
        const payload = await response.json();
        const content = payload.choices && payload.choices[0] && payload.choices[0].message
            ? payload.choices[0].message.content || ''
            : '';
        const parsed = parseStructuredSummary(content);
        if (!parsed.categories.length) {
            return buildFallbackSummary(input);
        }
        return {
            headline: parsed.headline,
            markdown: buildNewsMarkdown(parsed),
            categories: parsed.categories
        };
    }
    async resolveModel() {
        if (this.modelName) {
            return this.modelName;
        }
        const response = await this.request('/v1/models', undefined, 'LM Studio model discovery');
        if (!response.ok) {
            throw new Error(`LM Studio model discovery failed with status ${response.status}.`);
        }
        const payload = await response.json();
        const preferredModel = pickPreferredModel(payload.data || []);
        if (!preferredModel) {
            throw new Error('No LM Studio model is currently loaded.');
        }
        return preferredModel;
    }
    async request(path, init, label) {
        try {
            return await fetch(this.baseUrl + path, init);
        }
        catch (error) {
            if (this.baseUrl !== this.fallbackBaseUrl) {
                try {
                    return await fetch(this.fallbackBaseUrl + path, init);
                }
                catch (fallbackError) {
                    throw new Error(describeFetchFailure(label, this.fallbackBaseUrl + path, fallbackError));
                }
            }
            throw new Error(describeFetchFailure(label, this.baseUrl + path, error));
        }
    }
}
function buildMessages(input) {
    return [
        {
            role: 'system',
            content: 'You summarize news for a morning briefing. Return JSON only with this shape: ' +
                '{"headline":"string","categories":[{"name":"string","bullets":[{"headline":"string","summary":"string","url":"string","sourceName":"string"}]}]}. ' +
                'Use 2-4 bullets per category, prefer the strongest recurring themes, keep summaries concise, and preserve article URLs exactly.'
        },
        {
            role: 'user',
            content: JSON.stringify({
                snapshotDate: input.snapshotDate,
                categories: input.categories
            })
        }
    ];
}
function parseStructuredSummary(content) {
    const parsed = JSON.parse(extractJsonObject(content));
    const categories = Array.isArray(parsed.categories)
        ? parsed.categories.map(function mapCategory(category) {
            const categoryName = typeof category?.name === 'string' ? category.name.trim() : '';
            const bullets = Array.isArray(category?.bullets)
                ? category.bullets.map(function mapBullet(bullet) {
                    return {
                        headline: typeof bullet?.headline === 'string' ? bullet.headline.trim() : '',
                        summary: typeof bullet?.summary === 'string' ? bullet.summary.trim() : '',
                        url: typeof bullet?.url === 'string' ? bullet.url.trim() : '',
                        sourceName: typeof bullet?.sourceName === 'string' ? bullet.sourceName.trim() : ''
                    };
                }).filter(function filterBullet(bullet) {
                    return bullet.headline && bullet.url;
                })
                : [];
            return {
                name: categoryName,
                bullets
            };
        }).filter(function filterCategory(category) {
            return category.name && category.bullets.length;
        })
        : [];
    return {
        headline: typeof parsed.headline === 'string' && parsed.headline.trim()
            ? parsed.headline.trim()
            : 'Top stories from your RSS feeds.',
        categories
    };
}
function getProcessEnv() {
    const processLike = globalThis;
    return processLike.process && processLike.process.env
        ? processLike.process.env
        : {};
}
function extractJsonObject(content) {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('LM Studio did not return valid JSON.');
    }
    return content.slice(start, end + 1);
}
function buildNewsMarkdown(summary) {
    const lines = ['# ' + summary.headline];
    summary.categories.forEach(function appendCategory(category) {
        lines.push('');
        lines.push('## ' + category.name);
        category.bullets.forEach(function appendBullet(bullet) {
            const sourceSuffix = bullet.sourceName ? ' (' + bullet.sourceName + ')' : '';
            const summarySuffix = bullet.summary ? ' - ' + bullet.summary : '';
            lines.push('- [' + bullet.headline + '](' + bullet.url + ')' + sourceSuffix + summarySuffix);
        });
    });
    return lines.join('\n');
}
function buildFallbackSummary(input) {
    const categories = input.categories.map(function mapCategory(category) {
        return {
            name: category.name,
            bullets: category.articles.slice(0, 3).map(function mapArticle(article) {
                return {
                    headline: article.title,
                    summary: article.summary,
                    url: article.url,
                    sourceName: article.sourceName
                };
            })
        };
    }).filter(function filterCategory(category) {
        return category.bullets.length > 0;
    });
    const headline = categories.length
        ? 'Top stories across ' + categories.length + ' RSS categories.'
        : 'Top stories from your RSS feeds.';
    return {
        headline: headline,
        markdown: buildNewsMarkdown({
            headline: headline,
            categories: categories
        }),
        categories: categories
    };
}
function pickPreferredModel(models) {
    const candidates = models
        .map(function mapModel(model) {
        return typeof model.id === 'string' ? model.id.trim() : '';
    })
        .filter(function filterModel(modelId) {
        return !!modelId && modelId.indexOf('embed') === -1;
    });
    if (!candidates.length) {
        return null;
    }
    candidates.sort(function sortCandidates(left, right) {
        return scoreModel(right) - scoreModel(left);
    });
    return candidates[0];
}
function scoreModel(modelId) {
    const lower = modelId.toLowerCase();
    const sizeMatch = lower.match(/(\d+)(?:\.(\d+))?b/);
    const sizeScore = sizeMatch
        ? Number(sizeMatch[1]) * 100 + Number(sizeMatch[2] || 0)
        : 0;
    const chatBias = lower.indexOf('instruct') !== -1 || lower.indexOf('gemma') !== -1 ? 10_000 : 0;
    return chatBias + sizeScore;
}
