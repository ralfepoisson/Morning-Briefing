import { AVAILABLE_OPENAI_MODELS } from './tenant-ai-configuration-types.js';
export class TenantAiConfigurationService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getConfiguration(tenantId) {
        const record = await this.repository.findByTenantId(tenantId);
        if (!record) {
            return {
                id: null,
                tenantId,
                hasOpenAiApiKey: false,
                openAiModel: AVAILABLE_OPENAI_MODELS[0],
                availableOpenAiModels: AVAILABLE_OPENAI_MODELS,
                createdAt: null,
                updatedAt: null
            };
        }
        return {
            id: record.id,
            tenantId: record.tenantId,
            hasOpenAiApiKey: !!record.openAiApiKey,
            openAiModel: record.openAiModel,
            availableOpenAiModels: AVAILABLE_OPENAI_MODELS,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString()
        };
    }
    async updateConfiguration(input) {
        const existing = await this.repository.findByTenantId(input.tenantId);
        const nextModel = normalizeOpenAiModel(input.openAiModel || existing?.openAiModel || AVAILABLE_OPENAI_MODELS[0]);
        const nextApiKey = normalizeOpenAiApiKey(input.openAiApiKey, existing?.openAiApiKey || null);
        const saved = await this.repository.upsertByTenantId({
            tenantId: input.tenantId,
            openAiApiKey: nextApiKey,
            openAiModel: nextModel
        });
        return {
            id: saved.id,
            tenantId: saved.tenantId,
            hasOpenAiApiKey: !!saved.openAiApiKey,
            openAiModel: saved.openAiModel,
            availableOpenAiModels: AVAILABLE_OPENAI_MODELS,
            createdAt: saved.createdAt.toISOString(),
            updatedAt: saved.updatedAt.toISOString()
        };
    }
    async getRequiredOpenAiConfiguration(tenantId) {
        const record = await this.repository.findByTenantId(tenantId);
        if (!record || !record.openAiApiKey) {
            throw new Error('OpenAI configuration is missing. Add the API key in Admin > Configuration.');
        }
        return {
            apiKey: record.openAiApiKey,
            model: normalizeOpenAiModel(record.openAiModel)
        };
    }
}
function normalizeOpenAiModel(model) {
    if (AVAILABLE_OPENAI_MODELS.includes(model)) {
        return model;
    }
    return AVAILABLE_OPENAI_MODELS[0];
}
function normalizeOpenAiApiKey(nextApiKey, fallbackApiKey) {
    if (typeof nextApiKey !== 'string') {
        return fallbackApiKey;
    }
    if (!nextApiKey.trim()) {
        return fallbackApiKey;
    }
    return nextApiKey.trim();
}
