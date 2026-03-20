import type {
  ConnectionRecord,
  CreateConnectionInput,
  ListConnectionsInput,
  UpdateConnectionInput
} from './connection-types.js';

export interface ConnectionRepository {
  list(input: ListConnectionsInput): Promise<ConnectionRecord[]>;
  findById(tenantId: string, connectionId: string): Promise<ConnectionRecord | null>;
  create(input: CreateConnectionInput): Promise<ConnectionRecord>;
  update(input: UpdateConnectionInput): Promise<ConnectionRecord>;
}
