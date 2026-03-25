import { describeFetchFailure } from '../../shared/fetch-error.js';
import { logApplicationEvent } from '../admin/application-logger.js';
import type { TenantAiConfigurationService } from '../tenant-ai-configuration/tenant-ai-configuration-service.js';
import type {
  DashboardBriefingInput,
  DashboardBriefingScript
} from './dashboard-briefing-types.js';
import { DashboardBriefingPromptService } from './dashboard-briefing-prompt-service.js';

export interface DashboardBriefingLlmProvider {
  readonly providerName: string;
  readonly modelName: string;
  generateScript(input: DashboardBriefingInput, prompt: { developer: string; user: string }): Promise<string>;
}

export class DashboardBriefingLlmService {
  constructor(
    private readonly provider: DashboardBriefingLlmProvider,
    private readonly promptService: DashboardBriefingPromptService
  ) {}

  getModelName(): string {
    return this.provider.modelName;
  }

  async generateScript(input: DashboardBriefingInput): Promise<DashboardBriefingScript> {
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
          sectionCount: parsed.sections.length
        }
      });

      return parsed;
    } catch (error) {
      logApplicationEvent({
        level: this.provider.providerName === 'stub' ? 'error' : 'warn',
        scope: 'dashboard-briefing',
        event: 'dashboard_briefing_llm_failed',
        message: error instanceof Error ? error.message : 'Dashboard briefing script generation failed.',
        context: {
          dashboardId: input.dashboardId,
          provider: this.provider.providerName,
          modelName: this.provider.modelName
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

export class StubDashboardBriefingLlmProvider implements DashboardBriefingLlmProvider {
  readonly providerName = 'stub';
  readonly modelName = 'stub-template';

  async generateScript(input: DashboardBriefingInput): Promise<string> {
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

export class OpenAiDashboardBriefingLlmProvider implements DashboardBriefingLlmProvider {
  readonly providerName = 'openai';

  constructor(
    private readonly config: {
      apiKey: string;
      model: string;
      baseUrl?: string;
    }
  ) {}

  get modelName(): string {
    return this.config.model;
  }

  async generateScript(input: DashboardBriefingInput, prompt: { developer: string; user: string }): Promise<string> {
    const baseUrl = (this.config.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
    const url = baseUrl + '/v1/responses';
    let response: Response;

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
    } catch (error) {
      throw new Error(describeFetchFailure('OpenAI dashboard briefing request', url, error));
    }

    if (!response.ok) {
      throw new Error(`OpenAI dashboard briefing request failed with status ${response.status}.`);
    }

    return extractResponseText(await response.json() as {
      output?: Array<{
        content?: Array<{
          text?: string;
        }>;
      }>;
    });
  }
}

export class TenantConfiguredOpenAiDashboardBriefingLlmProvider implements DashboardBriefingLlmProvider {
  readonly providerName = 'openai';
  readonly modelName = 'tenant-admin-configuration';

  constructor(
    private readonly tenantAiConfigurationService: Pick<TenantAiConfigurationService, 'getRequiredOpenAiConfiguration'>
  ) {}

  async generateScript(input: DashboardBriefingInput, prompt: { developer: string; user: string }): Promise<string> {
    const configuration = await this.tenantAiConfigurationService.getRequiredOpenAiConfiguration(input.tenantId);
    const provider = new OpenAiDashboardBriefingLlmProvider({
      apiKey: configuration.apiKey,
      model: configuration.model
    });

    return provider.generateScript(input, prompt);
  }
}

function extractResponseText(payload: {
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
