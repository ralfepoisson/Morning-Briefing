import { describeFetchFailure } from '../../shared/fetch-error.js';
export class DashboardBriefingLlmService {
    provider;
    promptService;
    constructor(provider, promptService) {
        this.provider = provider;
        this.promptService = promptService;
    }
    getModelName() {
        return this.provider.modelName;
    }
    async generateScript(input) {
        const prompt = this.promptService.buildPrompt(input);
        try {
            const content = await this.provider.generateScript(input, prompt);
            return this.promptService.parseModelOutput(content, input);
        }
        catch (error) {
            if (this.provider.providerName === 'stub') {
                throw error;
            }
            return this.promptService.buildFallbackScript(input);
        }
    }
}
export class StubDashboardBriefingLlmProvider {
    providerName = 'stub';
    modelName = 'stub-template';
    async generateScript(input) {
        return JSON.stringify({
            title: `${input.dashboardName} Audio Briefing`,
            estimatedDurationSeconds: Math.min(Math.max(input.targetDurationSeconds, 45), 90),
            sections: input.sections.map(function mapSection(section) {
                return {
                    name: section.title,
                    script: `Here is your ${section.title.toLowerCase()}.`
                };
            }),
            fullScript: input.sections.map(function mapSection(section) {
                return `Here is your ${section.title.toLowerCase()}.`;
            }).join(' ')
        });
    }
}
export class OpenAiDashboardBriefingLlmProvider {
    config;
    providerName = 'openai';
    constructor(config) {
        this.config = config;
    }
    get modelName() {
        return this.config.model;
    }
    async generateScript(input, prompt) {
        const baseUrl = (this.config.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
        const url = baseUrl + '/v1/responses';
        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: 'Bearer ' + this.config.apiKey
                },
                body: JSON.stringify({
                    model: this.config.model,
                    reasoning: {
                        effort: 'low'
                    },
                    input: [
                        {
                            role: 'developer',
                            content: [
                                {
                                    type: 'input_text',
                                    text: prompt.developer
                                }
                            ]
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'input_text',
                                    text: prompt.user
                                }
                            ]
                        }
                    ]
                })
            });
        }
        catch (error) {
            throw new Error(describeFetchFailure('OpenAI dashboard briefing request', url, error));
        }
        if (!response.ok) {
            throw new Error(`OpenAI dashboard briefing request failed with status ${response.status}.`);
        }
        return extractResponseText(await response.json());
    }
}
function extractResponseText(payload) {
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
    }, []).join('\n');
}
