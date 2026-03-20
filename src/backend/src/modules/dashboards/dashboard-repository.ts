import type {
  ArchiveDashboardInput,
  CreateDashboardInput,
  DashboardRecord,
  UpdateDashboardInput
} from './dashboard-types.js';

export interface DashboardRepository {
  listForOwner(ownerUserId: string): Promise<DashboardRecord[]>;
  create(input: CreateDashboardInput): Promise<DashboardRecord>;
  update(input: UpdateDashboardInput): Promise<DashboardRecord | null>;
  archive(input: ArchiveDashboardInput): Promise<boolean>;
}
