import type { PrismaClient } from '@prisma/client';
import type { TenantAiConfigurationRepository } from './tenant-ai-configuration-repository.js';
import type { TenantAiConfigurationRecord } from './tenant-ai-configuration-types.js';

export class PrismaTenantAiConfigurationRepository implements TenantAiConfigurationRepository {
  constructor(private readonly prisma: Pick<PrismaClient, 'tenantAiConfiguration'>) {}

  async findByTenantId(tenantId: string): Promise<TenantAiConfigurationRecord | null> {
    const record = await this.prisma.tenantAiConfiguration.findUnique({
      where: {
        tenantId
      },
      select: {
        id: true,
        tenantId: true,
        openAiModel: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return record ? mapRecord(record) : null;
  }

  async upsertByTenantId(input: {
    tenantId: string;
    openAiModel: string;
  }): Promise<TenantAiConfigurationRecord> {
    const record = await this.prisma.tenantAiConfiguration.upsert({
      where: {
        tenantId: input.tenantId
      },
      update: {
        openAiModel: input.openAiModel
      },
      create: {
        tenantId: input.tenantId,
        openAiModel: input.openAiModel
      },
      select: {
        id: true,
        tenantId: true,
        openAiModel: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return mapRecord(record);
  }
}

function mapRecord(record: {
  id: string;
  tenantId: string;
  openAiModel: string;
  createdAt: Date;
  updatedAt: Date;
}): TenantAiConfigurationRecord {
  return {
    id: record.id,
    tenantId: record.tenantId,
    openAiModel: record.openAiModel,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}
