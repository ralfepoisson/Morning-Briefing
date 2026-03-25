export type ConnectionRecord = {
  id: string;
  tenantId: string;
  ownerUserId: string | null;
  type: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED' | 'ERROR';
  authType: 'NONE' | 'API_KEY' | 'OAUTH' | 'BASIC';
  baseUrl: string | null;
  config: Record<string, unknown>;
  secretRef: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListConnectionsInput = {
  tenantId: string;
  type?: string;
};

export type CreateConnectionInput = {
  tenantId: string;
  ownerUserId?: string;
  type: string;
  credentials: Record<string, unknown>;
};

export type UpdateConnectionInput = {
  tenantId: string;
  connectionId: string;
  ownerUserId?: string;
  name?: string;
  credentials?: Record<string, unknown>;
};

export type ConnectionResponse = {
  id: string;
  type: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED' | 'ERROR';
  authType: 'NONE' | 'API_KEY' | 'OAUTH' | 'BASIC';
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
