export const AVAILABLE_OPENAI_MODELS = [
  'gpt-5-mini',
  'gpt-5',
  'gpt-4.1-mini'
] as const;

export type AvailableOpenAiModel = typeof AVAILABLE_OPENAI_MODELS[number];

export type TenantAiConfigurationRecord = {
  id: string;
  tenantId: string;
  openAiApiKey: string | null;
  openAiModel: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantAiConfigurationResponse = {
  id: string | null;
  tenantId: string;
  hasOpenAiApiKey: boolean;
  openAiModel: string;
  availableOpenAiModels: readonly string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type TenantOpenAiConfiguration = {
  apiKey: string;
  model: string;
};
