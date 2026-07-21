import { describe, expect, it, vi } from 'vitest';
import { createConnectorsController } from './connectors.ts';
import type { RouteContext } from './admin.ts';

describe('connectors route controller', function () {
  it('lists, creates, updates and starts both Google OAuth flows', async function () {
    const calls: Array<{ path: string; init?: RequestInit | undefined }> = [];
    const context = makeContext(async function (path, init) {
      calls.push({ path, init });
      if (path.includes('/oauth/start')) return { authorizationUrl: 'https://accounts.example/authorize' };
      return { items: [] };
    });
    const controller = createConnectorsController(context, function () { return 'https://briefing.example/#/connectors'; });

    await controller.list();
    await controller.create({ type: 'todoist', credentials: { apiKey: 'token' } });
    await controller.update('c1', { name: 'Work', credentials: { apiKey: 'next' } });
    expect(await controller.startOAuth('google-calendar', 'c1')).toBe('https://accounts.example/authorize');
    expect(await controller.startOAuth('gmail')).toBe('https://accounts.example/authorize');

    expect(calls.map((call) => call.path)).toEqual([
      '/connections', '/connections', '/connections/c1',
      '/connections/google-calendar/oauth/start', '/connections/gmail/oauth/start'
    ]);
    expect(context.navigate).toHaveBeenCalledTimes(2);
  });
});

function makeContext(api: RouteContext['api']): RouteContext {
  return { api, container: { innerHTML: '' } as HTMLElement, notify: vi.fn(), navigate: vi.fn() };
}
