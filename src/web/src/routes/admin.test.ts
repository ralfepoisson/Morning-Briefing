import { describe, expect, it, vi } from 'vitest';
import { createAdminController, type RouteContext } from './admin.ts';

describe('admin route controller', function () {
  it('uses the admin endpoints for access, audio, snapshots, configuration, broker and logs', async function () {
    const calls: Array<{ path: string; init?: RequestInit | undefined }> = [];
    const context = makeContext(async function (path, init) {
      calls.push({ path, init });
      if (path === '/admin/users') return { items: [{ id: 'u1', isAdmin: false }] };
      if (path === '/admin/widgets/regenerate-all-snapshots') return { queuedCount: 3 };
      return { items: [] };
    });
    const admin = createAdminController(context);

    await admin.loadMessageBroker();
    await admin.loadUsers();
    await admin.updateUserAccess('u1', true);
    await admin.loadDashboards();
    await admin.regenerateDashboardAudio('d1');
    await admin.loadConfiguration();
    await admin.updateConfiguration({ openAiApiKey: 'replacement', openAiModel: 'gpt-5-mini' });
    await admin.loadConnectorInventory();
    await admin.loadWidgets();
    await admin.regenerateWidget('w1');
    await admin.regenerateAllWidgets();
    await admin.loadLogs({ q: 'failed', levels: ['error'], range: '24h', limit: 50 });

    expect(calls.map((call) => call.path)).toEqual([
      '/admin/message-broker', '/admin/users', '/admin/users/u1/access', '/admin/dashboards',
      '/admin/dashboards/d1/regenerate-audio-briefing', '/admin/configuration', '/admin/configuration',
      '/admin/connectors', '/admin/widgets', '/admin/widgets/w1/regenerate-snapshot',
      '/admin/widgets/regenerate-all-snapshots', '/admin/logs?q=failed&levels=error&limit=50&range=24h'
    ]);
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ isAdmin: true });
    expect(JSON.parse(String(calls[9]?.init?.body))).toEqual({ bypassDuplicateCheck: true });
    expect(context.notify).toHaveBeenCalled();
  });
});

function makeContext(api: RouteContext['api']): RouteContext {
  return {
    api,
    container: { innerHTML: '' } as HTMLElement,
    notify: vi.fn(),
    navigate: vi.fn()
  };
}
