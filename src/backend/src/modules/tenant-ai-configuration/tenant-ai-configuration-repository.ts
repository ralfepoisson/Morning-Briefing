import type { TenantAiConfigurationRecord } from './tenant-ai-configuration-types.js';

export interface TenantAiConfigurationRepository {
  findByTenantId(tenantId: string): Promise<TenantAiConfigurationRecord | null>;
  upsertByTenantId(input: {
    tenantId: string;
    openAiModel: string;
  }): Promise<TenantAiConfigurationRecord>;
}
