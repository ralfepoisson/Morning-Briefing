import type { ConnectionRepository } from './connection-repository.js';
import type {
  ConnectionResponse,
  CreateConnectionInput,
  UpdateConnectionInput
} from './connection-types.js';

export class ConnectionService {
  constructor(private readonly repository: ConnectionRepository) {}

  async listForTenant(tenantId: string, type?: string): Promise<ConnectionResponse[]> {
    const connections = await this.repository.list({
      tenantId,
      type
    });

    return connections.map(toResponse);
  }

  async create(input: CreateConnectionInput): Promise<ConnectionResponse> {
    validateCreateInput(input);

    const connection = await this.repository.create(input);
    return toResponse(connection);
  }

  async update(input: UpdateConnectionInput): Promise<ConnectionResponse> {
    const existingConnection = await this.repository.findById(input.tenantId, input.connectionId);

    if (!existingConnection) {
      throw new Error('Connection was not found.');
    }

    const nextName = typeof input.name === 'string' ? input.name.trim() : existingConnection.name;
    const nextCredentials = mergeCredentials(existingConnection.config, input.credentials || {});

    validateUpdateInput(existingConnection.type, nextName, nextCredentials);

    const connection = await this.repository.update({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      ownerUserId: input.ownerUserId,
      name: nextName,
      credentials: nextCredentials
    });

    return toResponse(connection);
  }
}

function validateCreateInput(input: CreateConnectionInput) {
  if (input.type !== 'todoist' && input.type !== 'google-calendar' && input.type !== 'gmail' && input.type !== 'openai') {
    throw new Error('Connection provider is not supported.');
  }

  if (input.type === 'todoist' && (typeof input.credentials.apiKey !== 'string' || !input.credentials.apiKey.trim())) {
    throw new Error('Todoist API key is required.');
  }

  if (input.type === 'google-calendar') {
    validateGoogleCalendarOAuthCredentials(input.credentials);
  }

  if (input.type === 'gmail') {
    validateGmailOAuthCredentials(input.credentials);
  }

  if (input.type === 'openai') {
    validateOpenAiCredentials(input.credentials);
  }
}

function validateUpdateInput(type: string, name: string, credentials: Record<string, unknown>) {
  if (type !== 'todoist' && type !== 'google-calendar' && type !== 'gmail' && type !== 'openai') {
    throw new Error('Connection provider is not supported.');
  }

  if (!name) {
    throw new Error('Connection name is required.');
  }

  if (type === 'todoist' && (typeof credentials.apiKey !== 'string' || !credentials.apiKey.trim())) {
    throw new Error('Todoist API key is required.');
  }

  if (type === 'google-calendar') {
    validateGoogleCalendarStoredCredentials(credentials);
  }

  if (type === 'gmail') {
    validateGmailStoredCredentials(credentials);
  }

  if (type === 'openai') {
    validateOpenAiCredentials(credentials);
  }
}

function mergeCredentials(
  existingCredentials: Record<string, unknown>,
  incomingCredentials: Record<string, unknown>
): Record<string, unknown> {
  return Object.keys(incomingCredentials).reduce<Record<string, unknown>>(function build(next, key) {
    if (typeof incomingCredentials[key] === 'undefined') {
      return next;
    }

    if (typeof incomingCredentials[key] === 'string') {
      const trimmedValue = incomingCredentials[key].trim();

      if (trimmedValue) {
        next[key] = trimmedValue;
      }

      return next;
    }

    next[key] = incomingCredentials[key];
    return next;
  }, {
    ...existingCredentials
  });
}

function validateGoogleCalendarOAuthCredentials(credentials: Record<string, unknown>) {
  const accessToken = typeof credentials.accessToken === 'string' ? credentials.accessToken.trim() : '';
  const refreshToken = typeof credentials.refreshToken === 'string' ? credentials.refreshToken.trim() : '';
  const calendarId = typeof credentials.calendarId === 'string' ? credentials.calendarId.trim() : '';

  if (!accessToken) {
    throw new Error('Google Calendar access token is required.');
  }

  if (!refreshToken) {
    throw new Error('Google Calendar refresh token is required.');
  }

  if (!calendarId) {
    throw new Error('Google Calendar calendar id is required.');
  }
}

function validateGoogleCalendarStoredCredentials(credentials: Record<string, unknown>) {
  const refreshToken = typeof credentials.refreshToken === 'string' ? credentials.refreshToken.trim() : '';
  const calendarId = typeof credentials.calendarId === 'string' ? credentials.calendarId.trim() : '';

  if (!refreshToken) {
    throw new Error('Google Calendar refresh token is required.');
  }

  if (!calendarId) {
    throw new Error('Google Calendar calendar id is required.');
  }
}

function validateGmailOAuthCredentials(credentials: Record<string, unknown>) {
  const accessToken = typeof credentials.accessToken === 'string' ? credentials.accessToken.trim() : '';
  const refreshToken = typeof credentials.refreshToken === 'string' ? credentials.refreshToken.trim() : '';
  const accountEmail = typeof credentials.accountEmail === 'string' ? credentials.accountEmail.trim() : '';

  if (!accessToken) {
    throw new Error('Gmail access token is required.');
  }

  if (!refreshToken) {
    throw new Error('Gmail refresh token is required.');
  }

  if (!accountEmail) {
    throw new Error('Gmail account email is required.');
  }
}

function validateGmailStoredCredentials(credentials: Record<string, unknown>) {
  const refreshToken = typeof credentials.refreshToken === 'string' ? credentials.refreshToken.trim() : '';
  const accountEmail = typeof credentials.accountEmail === 'string' ? credentials.accountEmail.trim() : '';

  if (!refreshToken) {
    throw new Error('Gmail refresh token is required.');
  }

  if (!accountEmail) {
    throw new Error('Gmail account email is required.');
  }
}

function toResponse(connection: {
  id: string;
  type: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED' | 'ERROR';
  authType: 'NONE' | 'API_KEY' | 'OAUTH' | 'BASIC';
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}): ConnectionResponse {
  return {
    id: connection.id,
    type: connection.type,
    name: connection.name,
    status: connection.status,
    authType: connection.authType,
    config: sanitizeConnectionConfig(connection.type, connection.config || {}),
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString()
  };
}

function sanitizeConnectionConfig(type: string, config: Record<string, unknown>): Record<string, unknown> {
  if (type === 'google-calendar') {
    return {
      calendarId: typeof config.calendarId === 'string' ? config.calendarId : '',
      accountEmail: typeof config.accountEmail === 'string' ? config.accountEmail : '',
      accountLabel: typeof config.accountLabel === 'string' ? config.accountLabel : ''
    };
  }

  if (type === 'gmail') {
    return {
      accountEmail: typeof config.accountEmail === 'string' ? config.accountEmail : '',
      accountLabel: typeof config.accountLabel === 'string' ? config.accountLabel : ''
    };
  }

  if (type === 'openai') {
    return {
      model: typeof config.model === 'string' ? config.model : 'gpt-5-mini',
      baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : 'https://api.openai.com'
    };
  }

  return {};
}

function validateOpenAiCredentials(credentials: Record<string, unknown>) {
  const apiKey = typeof credentials.apiKey === 'string' ? credentials.apiKey.trim() : '';

  if (!apiKey) {
    throw new Error('OpenAI API key is required.');
  }
}
