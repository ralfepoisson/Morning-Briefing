import type { DashboardRepository } from './dashboard-repository.js';
import type {
  ArchiveDashboardInput,
  CreateDashboardInput,
  DashboardResponse,
  UpdateDashboardInput
} from './dashboard-types.js';

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async listForOwner(ownerUserId: string): Promise<DashboardResponse[]> {
    const dashboards = await this.repository.listForOwner(ownerUserId);

    return dashboards.map(toResponse);
  }

  async create(input: CreateDashboardInput): Promise<DashboardResponse> {
    const name = normalizeName(input.name);

    if (!name) {
      throw new Error('Dashboard name is required.');
    }

    const dashboard = await this.repository.create({
      ...input,
      name,
      description: normalizeDescription(input.description),
      theme: normalizeTheme(input.theme)
    });

    return toResponse(dashboard);
  }

  async update(input: UpdateDashboardInput): Promise<DashboardResponse | null> {
    const name = normalizeName(input.name);

    if (!name) {
      throw new Error('Dashboard name is required.');
    }

    const dashboard = await this.repository.update({
      ...input,
      name,
      description: normalizeDescription(input.description)
    });

    return dashboard ? toResponse(dashboard) : null;
  }

  async archive(input: ArchiveDashboardInput): Promise<boolean> {
    return this.repository.archive(input);
  }
}

function normalizeName(value: string): string {
  return value.trim();
}

function normalizeDescription(value?: string): string {
  return (value || '').trim();
}

function normalizeTheme(value?: string): string {
  return (value || 'aurora').trim() || 'aurora';
}

function toResponse(dashboard: {
  id: string;
  name: string;
  description: string;
  theme: string;
  isGenerating: boolean;
  createdAt: Date;
  updatedAt: Date;
}): DashboardResponse {
  return {
    id: dashboard.id,
    name: dashboard.name,
    description: dashboard.description,
    theme: dashboard.theme,
    isGenerating: dashboard.isGenerating,
    createdAt: dashboard.createdAt.toISOString(),
    updatedAt: dashboard.updatedAt.toISOString()
  };
}
