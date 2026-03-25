export class PrismaConnectionRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(input) {
        const connectors = await this.prisma.connector.findMany({
            where: {
                tenantId: input.tenantId,
                connectorType: input.type || undefined
            },
            orderBy: [
                { createdAt: 'desc' }
            ]
        });
        return connectors.map(mapConnectionRecord);
    }
    async findById(tenantId, connectionId) {
        const connector = await this.prisma.connector.findFirst({
            where: {
                id: connectionId,
                tenantId
            }
        });
        return connector ? mapConnectionRecord(connector) : null;
    }
    async create(input) {
        const connector = await this.prisma.connector.create({
            data: {
                tenantId: input.tenantId,
                ownerUserId: typeof input.ownerUserId === 'string' && input.ownerUserId.trim() ? input.ownerUserId.trim() : undefined,
                connectorType: input.type,
                name: buildConnectionName(input.type),
                status: 'ACTIVE',
                authType: getConnectionAuthType(input.type, input.credentials),
                configJson: normalizeConfig(input.credentials)
            }
        });
        return mapConnectionRecord(connector);
    }
    async update(input) {
        const existingConnector = await this.prisma.connector.findUniqueOrThrow({
            where: {
                id: input.connectionId
            }
        });
        const connector = await this.prisma.connector.update({
            where: {
                id: input.connectionId
            },
            data: {
                ownerUserId: typeof input.ownerUserId === 'string' && input.ownerUserId.trim() ? input.ownerUserId.trim() : undefined,
                name: typeof input.name === 'string' ? input.name.trim() : undefined,
                authType: input.credentials ? getConnectionAuthType(existingConnector.connectorType, input.credentials) : undefined,
                configJson: input.credentials ? normalizeConfig(input.credentials) : undefined,
                status: 'ACTIVE'
            }
        });
        return mapConnectionRecord(connector);
    }
}
function mapConnectionRecord(connector) {
    return {
        id: connector.id,
        tenantId: connector.tenantId,
        ownerUserId: connector.ownerUserId,
        type: connector.connectorType,
        name: connector.name,
        status: connector.status,
        authType: connector.authType,
        baseUrl: connector.baseUrl,
        config: asObject(connector.configJson),
        secretRef: connector.secretRef,
        lastSyncAt: connector.lastSyncAt,
        createdAt: connector.createdAt,
        updatedAt: connector.updatedAt
    };
}
function normalizeConfig(config) {
    return Object.keys(config).reduce(function build(next, key) {
        if (typeof config[key] === 'undefined') {
            return next;
        }
        next[key] = config[key];
        return next;
    }, {});
}
function asObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return {};
}
function buildConnectionName(type) {
    if (type === 'todoist') {
        return 'Todoist';
    }
    if (type === 'google-calendar') {
        return 'Google Calendar';
    }
    if (type === 'openai') {
        return 'OpenAI';
    }
    return 'Connection';
}
function getConnectionAuthType(type, credentials) {
    if (type === 'todoist') {
        return 'API_KEY';
    }
    if (type === 'google-calendar') {
        return typeof credentials.refreshToken === 'string' && credentials.refreshToken.trim()
            ? 'OAUTH'
            : 'API_KEY';
    }
    if (type === 'openai') {
        return 'API_KEY';
    }
    return 'NONE';
}
