import { AVAILABLE_OPENAI_MODELS } from './tenant-ai-configuration-types.js';
export class TenantAiConfigurationService {
    repository;
    env;
    constructor(repository, env = process.env) {
        this.repository = repository;
        this.env = env;
    }
    async getConfiguration(tenantId) {
        const record = await this.repository.findByTenantId(tenantId);
        if (!record) {
            return {
                id: null,
                tenantId,
                hasOpenAiApiKey: readOpenAiApiKey(this.env) !== null,
                openAiModel: AVAILABLE_OPENAI_MODELS[0],
                availableOpenAiModels: AVAILABLE_OPENAI_MODELS,
                createdAt: null,
                updatedAt: null
            };
        }
        return {
            id: record.id,
            tenantId: record.tenantId,
            hasOpenAiApiKey: readOpenAiApiKey(this.env) !== null,
            openAiModel: record.openAiModel,
            availableOpenAiModels: AVAILABLE_OPENAI_MODELS,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString()
        };
    }
    async updateConfiguration(input) {
        const existing = await this.repository.findByTenantId(input.tenantId);
        const nextModel = normalizeOpenAiModel(input.openAiModel || existing?.openAiModel || AVAILABLE_OPENAI_MODELS[0]);
        const saved = await this.repository.upsertByTenantId({
            tenantId: input.tenantId,
            openAiModel: nextModel
        });
        return {
            id: saved.id,
            tenantId: saved.tenantId,
            hasOpenAiApiKey: readOpenAiApiKey(this.env) !== null,
            openAiModel: saved.openAiModel,
            availableOpenAiModels: AVAILABLE_OPENAI_MODELS,
            createdAt: saved.createdAt.toISOString(),
            updatedAt: saved.updatedAt.toISOString()
        };
    }
    async getRequiredOpenAiConfiguration(tenantId) {
        const record = await this.repository.findByTenantId(tenantId);
        const apiKey = readOpenAiApiKey(this.env);
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not configured in the protected runtime environment.');
        }
        return {
            apiKey,
            model: normalizeOpenAiModel(record?.openAiModel || AVAILABLE_OPENAI_MODELS[0])
        };
    }
}
function normalizeOpenAiModel(model) {
    if (AVAILABLE_OPENAI_MODELS.includes(model)) {
        return model;
    }
    return AVAILABLE_OPENAI_MODELS[0];
}
function readOpenAiApiKey(env) {
    const value = env.OPENAI_API_KEY?.trim();
    return value || null;
}
