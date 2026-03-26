import type { PrismaClient } from '@prisma/client';
import type { ConnectionRepository } from './connection-repository.js';
import type {
  ConnectionRecord,
  CreateConnectionInput,
  ListConnectionsInput,
  UpdateConnectionInput
} from './connection-types.js';

export class PrismaConnectionRepository implements ConnectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(input: ListConnectionsInput): Promise<ConnectionRecord[]> {
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

  async findById(tenantId: string, connectionId: string): Promise<ConnectionRecord | null> {
    const connector = await this.prisma.connector.findFirst({
      where: {
        id: connectionId,
        tenantId
      }
    });

    return connector ? mapConnectionRecord(connector) : null;
  }

  async create(input: CreateConnectionInput): Promise<ConnectionRecord> {
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

  async update(input: UpdateConnectionInput): Promise<ConnectionRecord> {
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

function mapConnectionRecord(connector: {
  id: string;
  tenantId: string;
  ownerUserId: string | null;
  connectorType: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED' | 'ERROR';
  authType: 'NONE' | 'API_KEY' | 'OAUTH' | 'BASIC';
  baseUrl: string | null;
  configJson: unknown;
  secretRef: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ConnectionRecord {
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

function normalizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(config).reduce<Record<string, unknown>>(function build(next, key) {
    if (typeof config[key] === 'undefined') {
      return next;
    }

    next[key] = config[key];
    return next;
  }, {});
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function buildConnectionName(type: string): string {
  if (type === 'todoist') {
    return 'Todoist';
  }

  if (type === 'google-calendar') {
    return 'Google Calendar';
  }

  if (type === 'gmail') {
    return 'Gmail';
  }

  if (type === 'openai') {
    return 'OpenAI';
  }

  return 'Connection';
}

function getConnectionAuthType(type: string, credentials: Record<string, unknown>): 'NONE' | 'API_KEY' | 'OAUTH' | 'BASIC' {
  if (type === 'todoist') {
    return 'API_KEY';
  }

  if (type === 'google-calendar') {
    return typeof credentials.refreshToken === 'string' && credentials.refreshToken.trim()
      ? 'OAUTH'
      : 'API_KEY';
  }

  if (type === 'gmail') {
    return typeof credentials.refreshToken === 'string' && credentials.refreshToken.trim()
      ? 'OAUTH'
      : 'API_KEY';
  }

  if (type === 'openai') {
    return 'API_KEY';
  }

  return 'NONE';
}
