import type { PrismaClient } from '@prisma/client';
import type { DashboardRepository } from './dashboard-repository.js';
import type {
  CreateDashboardInput,
  DashboardRecord,
  UpdateDashboardInput
} from './dashboard-types.js';

export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listForOwner(ownerUserId: string): Promise<DashboardRecord[]> {
    const dashboards = await this.prisma.dashboard.findMany({
      where: {
        ownerUserId
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    return dashboards.map(mapDashboardRecord);
  }

  async create(input: CreateDashboardInput): Promise<DashboardRecord> {
    const owner = await this.prisma.appUser.findUniqueOrThrow({
      where: {
        id: input.ownerUserId
      }
    });

    const dashboard = await this.prisma.dashboard.create({
      data: {
        tenantId: owner.tenantId,
        ownerUserId: input.ownerUserId,
        name: input.name,
        description: input.description || '',
        themeJson: {
          key: input.theme || 'aurora'
        }
      }
    });

    return mapDashboardRecord(dashboard);
  }

  async update(input: UpdateDashboardInput): Promise<DashboardRecord | null> {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: {
        id: input.dashboardId,
        ownerUserId: input.ownerUserId
      }
    });

    if (!dashboard) {
      return null;
    }

    const updatedDashboard = await this.prisma.dashboard.update({
      where: {
        id: dashboard.id
      },
      data: {
        name: input.name,
        description: input.description || '',
        version: {
          increment: 1
        }
      }
    });

    return mapDashboardRecord(updatedDashboard);
  }
}

function mapDashboardRecord(dashboard: {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  themeJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DashboardRecord {
  return {
    id: dashboard.id,
    ownerUserId: dashboard.ownerUserId,
    name: dashboard.name,
    description: dashboard.description || '',
    theme: getThemeKey(dashboard.themeJson),
    createdAt: dashboard.createdAt,
    updatedAt: dashboard.updatedAt
  };
}

function getThemeKey(themeJson: unknown): string {
  if (themeJson && typeof themeJson === 'object' && 'key' in themeJson) {
    const key = (themeJson as { key?: unknown }).key;

    if (typeof key === 'string' && key.trim()) {
      return key;
    }
  }

  return 'aurora';
}
