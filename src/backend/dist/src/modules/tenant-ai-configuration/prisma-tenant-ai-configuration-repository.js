export class PrismaTenantAiConfigurationRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByTenantId(tenantId) {
        const record = await this.prisma.tenantAiConfiguration.findUnique({
            where: {
                tenantId
            }
        });
        return record ? mapRecord(record) : null;
    }
    async upsertByTenantId(input) {
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
function mapRecord(record) {
    return {
        id: record.id,
        tenantId: record.tenantId,
        openAiApiKey: record.openAiApiKey,
        openAiModel: record.openAiModel,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}
