import type { PrismaClient } from '@prisma/client';
import type { TenantAiConfigurationRepository } from './tenant-ai-configuration-repository.js';
import type { TenantAiConfigurationRecord } from './tenant-ai-configuration-types.js';

export class PrismaTenantAiConfigurationRepository implements TenantAiConfigurationRepository {
  constructor(private readonly prisma: Pick<PrismaClient, 'tenantAiConfiguration'>) {}

  async findByTenantId(tenantId: string): Promise<TenantAiConfigurationRecord | null> {
    const record = await this.prisma.tenantAiConfiguration.findUnique({
      where: {
        tenantId
      }
    });

    return record ? mapRecord(record) : null;
  }

  async upsertByTenantId(input: {
    tenantId: string;
    openAiApiKey: string | null;
    openAiModel: string;
  }): Promise<TenantAiConfigurationRecord> {
    const record = await this.prisma.tenantAiConfiguration.upsert({
      where: {
        tenantId: input.tenantId
      },
      update: {
        openAiApiKey: input.openAiApiKey,
        openAiModel: input.openAiModel
      },
      create: {
        tenantId: input.tenantId,
        openAiApiKey: input.openAiApiKey,
        openAiModel: input.openAiModel
      }
    });

    return mapRecord(record);
  }
}

function mapRecord(record: {
  id: string;
  tenantId: string;
  openAiApiKey: string | null;
  openAiModel: string;
  createdAt: Date;
  updatedAt: Date;
}): TenantAiConfigurationRecord {
  return {
    id: record.id,
    tenantId: record.tenantId,
    openAiApiKey: record.openAiApiKey,
    openAiModel: record.openAiModel,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}
