import { describeFetchFailure } from '../../shared/fetch-error.js';
import { logApplicationEvent, toLogErrorContext } from '../admin/application-logger.js';
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
        logApplicationEvent({
            level: 'info',
            scope: 'dashboard-briefing',
            event: 'dashboard_briefing_llm_started',
            message: 'Starting dashboard briefing script generation.',
            context: {
                dashboardId: input.dashboardId,
                provider: this.provider.providerName,
                modelName: this.provider.modelName,
                sectionCount: input.sections.length,
                targetDurationSeconds: input.targetDurationSeconds
            }
        });
        try {
            const content = await this.provider.generateScript(input, prompt);
            const parsed = this.promptService.parseModelOutput(content, input);
            logApplicationEvent({
                level: 'info',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_llm_completed',
                message: 'Dashboard briefing script generation completed.',
                context: {
                    dashboardId: input.dashboardId,
                    provider: this.provider.providerName,
                    modelName: this.provider.modelName,
                    estimatedDurationSeconds: parsed.estimatedDurationSeconds,
                    scriptCharacterCount: parsed.fullScript.length
                }
            });
            return parsed;
        }
        catch (error) {
            logApplicationEvent({
                level: this.provider.providerName === 'stub' ? 'error' : 'warn',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_llm_failed',
                message: error instanceof Error ? error.message : 'Dashboard briefing script generation failed.',
                context: {
                    dashboardId: input.dashboardId,
                    provider: this.provider.providerName,
                    modelName: this.provider.modelName,
                    ...toLogErrorContext(error)
                }
            });
            if (this.provider.providerName === 'stub') {
                throw error;
            }
            logApplicationEvent({
                level: 'warn',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_llm_fallback_used',
                message: 'Falling back to template dashboard briefing script.',
                context: {
                    dashboardId: input.dashboardId,
                    provider: this.provider.providerName,
                    modelName: this.provider.modelName
                }
            });
            return this.promptService.buildFallbackScript(input);
        }
    }
}
export class StubDashboardBriefingLlmProvider {
    providerName = 'stub';
    modelName = 'stub-template';
    async generateScript(input) {
        return input.sections.map(function mapSection(section) {
            return `Here is your ${section.title.toLowerCase()}.`;
        }).join(' ');
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
export class TenantConfiguredOpenAiDashboardBriefingLlmProvider {
    tenantAiConfigurationService;
    providerName = 'openai';
    modelName = 'tenant-admin-configuration';
    constructor(tenantAiConfigurationService) {
        this.tenantAiConfigurationService = tenantAiConfigurationService;
    }
    async generateScript(input, prompt) {
        const configuration = await this.tenantAiConfigurationService.getRequiredOpenAiConfiguration(input.tenantId);
        const provider = new OpenAiDashboardBriefingLlmProvider({
            apiKey: configuration.apiKey,
            model: configuration.model
        });
        return provider.generateScript(input, prompt);
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
