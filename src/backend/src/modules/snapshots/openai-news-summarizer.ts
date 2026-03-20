import { describeFetchFailure } from '../../shared/fetch-error.js';

export class OpenAiNewsSummarizer {
  async summarize(input: {
    apiKey: string;
    model: string;
    baseUrl?: string;
    snapshotDate: string;
    categories: Array<{
      name: string;
      description: string;
      articles: Array<{
        title: string;
        url: string;
        summary: string;
        sourceName: string;
        publishedAt: string | null;
      }>;
    }>;
  }): Promise<{
    headline: string;
    markdown: string;
    categories: Array<{
      name: string;
      bullets: Array<{
        headline: string;
        summary: string;
        url: string;
        sourceName: string;
      }>;
    }>;
  }> {
    const baseUrl = (input.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
    const url = baseUrl + '/v1/responses';
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + input.apiKey
        },
        body: JSON.stringify({
          model: input.model,
          reasoning: {
            effort: 'low'
          },
          input: [
            {
              role: 'developer',
              content: [
                {
                  type: 'input_text',
                  text:
                    'You summarize news for a morning briefing. Return JSON only with this shape: ' +
                    '{"headline":"string","categories":[{"name":"string","bullets":[{"headline":"string","summary":"string","url":"string","sourceName":"string"}]}]}. ' +
                    'Use 2-4 bullets per category, prefer the strongest recurring themes, keep summaries concise, and preserve article URLs exactly.'
                }
              ]
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: JSON.stringify({
                    snapshotDate: input.snapshotDate,
                    categories: input.categories
                  })
                }
              ]
            }
          ]
        })
      });
    } catch (error) {
      throw new Error(describeFetchFailure('OpenAI Responses API request', url, error));
    }

    if (!response.ok) {
      throw new Error(`OpenAI Responses API request failed with status ${response.status}.`);
    }

    const payload = await response.json() as {
      output?: Array<{
        content?: Array<{
          text?: string;
        }>;
      }>;
    };
    const content = extractText(payload);
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
}

function extractText(payload: {
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
}): string {
  if (!Array.isArray(payload.output)) {
    return '';
  }

  return payload.output.reduce(function collect(chunks, item) {
    if (!item || !Array.isArray(item.content)) {
      return chunks;
    }

    item.content.forEach(function append(content) {
      if (content && typeof content.text === 'string' && content.text.trim()) {
        chunks.push(content.text);
      }
    });

    return chunks;
  }, [] as string[]).join('\n');
}

function parseStructuredSummary(content: string): {
  headline: string;
  categories: Array<{
    name: string;
    bullets: Array<{
      headline: string;
      summary: string;
      url: string;
      sourceName: string;
    }>;
  }>;
} {
  const parsed = JSON.parse(extractJsonObject(content)) as {
    headline?: unknown;
    categories?: unknown;
  };

  const categories = Array.isArray(parsed.categories)
    ? parsed.categories.map(function mapCategory(category) {
      const categoryName = typeof category?.name === 'string' ? category.name.trim() : '';
      const bullets = Array.isArray(category?.bullets)
        ? category.bullets.map(function mapBullet(bullet: unknown) {
          return {
            headline: typeof bullet?.headline === 'string' ? bullet.headline.trim() : '',
            summary: typeof bullet?.summary === 'string' ? bullet.summary.trim() : '',
            url: typeof bullet?.url === 'string' ? bullet.url.trim() : '',
            sourceName: typeof bullet?.sourceName === 'string' ? bullet.sourceName.trim() : ''
          };
        }).filter(function filterBullet(bullet: {
          headline: string;
          summary: string;
          url: string;
          sourceName: string;
        }) {
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

function extractJsonObject(content: string): string {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('OpenAI did not return valid JSON.');
  }

  return content.slice(start, end + 1);
}

function buildFallbackSummary(input: {
  snapshotDate: string;
  categories: Array<{
    name: string;
    description: string;
    articles: Array<{
      title: string;
      url: string;
      summary: string;
      sourceName: string;
      publishedAt: string | null;
    }>;
  }>;
}): {
  headline: string;
  markdown: string;
  categories: Array<{
    name: string;
    bullets: Array<{
      headline: string;
      summary: string;
      url: string;
      sourceName: string;
    }>;
  }>;
} {
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

function buildNewsMarkdown(summary: {
  headline: string;
  categories: Array<{
    name: string;
    bullets: Array<{
      headline: string;
      summary: string;
      url: string;
      sourceName: string;
    }>;
  }>;
}): string {
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
