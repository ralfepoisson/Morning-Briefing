import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardService } from './dashboard-service.js';
import type { DashboardRepository } from './dashboard-repository.js';
import type {
  ArchiveDashboardInput,
  CreateDashboardInput,
  DashboardRecord,
  UpdateDashboardInput
} from './dashboard-types.js';

test('DashboardService lists dashboards in repository order and maps theme', async function () {
  const repository = new InMemoryDashboardRepository([
    createDashboardRecord({
      id: 'dash-1',
      name: 'Morning Focus',
      description: 'A calm start',
      theme: 'aurora'
    })
  ]);
  const service = new DashboardService(repository);

  const dashboards = await service.listForOwner('user-1');

  assert.equal(dashboards.length, 1);
  assert.deepEqual(dashboards[0], {
    id: 'dash-1',
    name: 'Morning Focus',
    description: 'A calm start',
    theme: 'aurora',
    isGenerating: false,
    createdAt: repository.items[0].createdAt.toISOString(),
    updatedAt: repository.items[0].updatedAt.toISOString()
  });
});

test('DashboardService trims dashboard input and defaults theme', async function () {
  const repository = new InMemoryDashboardRepository([]);
  const service = new DashboardService(repository);

  const dashboard = await service.create({
    ownerUserId: 'user-1',
    name: '  Weekend Reset  ',
    description: '  A slower dashboard  '
  });

  assert.equal(dashboard.name, 'Weekend Reset');
  assert.equal(dashboard.description, 'A slower dashboard');
  assert.equal(dashboard.theme, 'aurora');
});

test('DashboardService rejects blank dashboard names', async function () {
  const repository = new InMemoryDashboardRepository([]);
  const service = new DashboardService(repository);

  await assert.rejects(
    function () {
      return service.create({
        ownerUserId: 'user-1',
        name: '   '
      });
    },
    {
      message: 'Dashboard name is required.'
    }
  );
});

test('DashboardService archives a dashboard through the repository', async function () {
  const repository = new InMemoryDashboardRepository([
    createDashboardRecord({
      id: 'dash-1'
    })
  ]);
  const service = new DashboardService(repository);

  const archived = await service.archive({
    dashboardId: 'dash-1',
    ownerUserId: 'user-1'
  });

  assert.equal(archived, true);
  assert.deepEqual(repository.archivedInputs[0], {
    dashboardId: 'dash-1',
    ownerUserId: 'user-1'
  });
});

class InMemoryDashboardRepository implements DashboardRepository {
  public archivedInputs: ArchiveDashboardInput[] = [];

  constructor(public readonly items: DashboardRecord[]) {}

  async listForOwner(ownerUserId: string): Promise<DashboardRecord[]> {
    return this.items.filter(function (item) {
      return item.ownerUserId === ownerUserId;
    });
  }

  async create(input: CreateDashboardInput): Promise<DashboardRecord> {
    const dashboard = createDashboardRecord({
      id: `dash-${this.items.length + 1}`,
      ownerUserId: input.ownerUserId,
      name: input.name,
      description: input.description || '',
      theme: input.theme || 'aurora'
    });

    this.items.push(dashboard);
    return dashboard;
  }

  async update(input: UpdateDashboardInput): Promise<DashboardRecord | null> {
    const dashboard = this.items.find(function (item) {
      return item.id === input.dashboardId && item.ownerUserId === input.ownerUserId;
    });

    if (!dashboard) {
      return null;
    }

    dashboard.name = input.name;
    dashboard.description = input.description || '';
    dashboard.updatedAt = new Date();
    return dashboard;
  }

  async archive(input: ArchiveDashboardInput): Promise<boolean> {
    const dashboard = this.items.find(function (item) {
      return item.id === input.dashboardId && item.ownerUserId === input.ownerUserId;
    });

    this.archivedInputs.push(input);
    return !!dashboard;
  }
}

function createDashboardRecord(overrides: Partial<DashboardRecord>): DashboardRecord {
  return {
    id: overrides.id || 'dash-1',
    ownerUserId: overrides.ownerUserId || 'user-1',
    name: overrides.name || 'Morning Focus',
    description: overrides.description || '',
    theme: overrides.theme || 'aurora',
    isGenerating: overrides.isGenerating || false,
    createdAt: overrides.createdAt || new Date('2026-03-19T07:00:00.000Z'),
    updatedAt: overrides.updatedAt || new Date('2026-03-19T07:00:00.000Z')
  };
}
