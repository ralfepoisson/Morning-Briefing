import { describe, expect, it, vi } from 'vitest';
import { createProfileController } from './profile.ts';
import type { RouteContext } from './admin.ts';

describe('profile route controller', function () {
  it('loads and saves identity, avatar, language, and Telegram delivery', async function () {
    const calls: Array<{ path: string; init?: RequestInit | undefined }> = [];
    const context = makeContext(async function (path, init) {
      calls.push({ path, init });
      return { user: { displayName: 'Ralfe', email: 'r@example.test', timezone: 'Europe/Paris', preferredLanguage: 'fr-FR' } };
    });
    const profile = createProfileController(context);
    const loaded = await profile.load();
    await profile.save({ ...loaded, avatarDataUrl: 'data:image/webp;base64,AA==', briefingDelivery: { telegram: { enabled: true, chatId: '123' } } });

    expect(calls.map((call) => call.path)).toEqual(['/users/me', '/users/me']);
    expect(calls[1]?.init?.method).toBe('PATCH');
    expect(JSON.parse(String(calls[1]?.init?.body))).toMatchObject({
      preferredLanguage: 'fr-FR', avatarDataUrl: 'data:image/webp;base64,AA==',
      briefingDelivery: { telegram: { enabled: true, chatId: '123' } }
    });
  });

  it('rejects enabled Telegram delivery without a chat id', async function () {
    const profile = createProfileController(makeContext(async function () { return {}; }));
    await expect(profile.save({ displayName: 'R', email: 'r@example.test', timezone: 'UTC', preferredLanguage: 'en-GB', avatarDataUrl: null, phoneticName: null, briefingDelivery: { telegram: { enabled: true, chatId: '' } } })).rejects.toThrow(/Telegram chat ID/);
  });
});

function makeContext(api: RouteContext['api']): RouteContext {
  return { api, container: { innerHTML: '' } as HTMLElement, notify: vi.fn(), navigate: vi.fn() };
}
