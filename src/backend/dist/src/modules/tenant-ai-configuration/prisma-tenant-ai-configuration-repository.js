export class PrismaTenantAiConfigurationRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByTenantId(tenantId) {
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
    async upsertByTenantId(input) {
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
function mapRecord(record) {
    return {
        id: record.id,
        tenantId: record.tenantId,
        openAiModel: record.openAiModel,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}
