import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestJson, ApiError } from './http.ts';

afterEach(() => vi.unstubAllGlobals());

describe('authenticated API requests', () => {
  it('sends the captured bearer token and exposes successful JSON', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"items":[]}'));
    vi.stubGlobal('fetch', fetch);
    expect(await requestJson('/api/v1/dashboards', {}, 'session-token', vi.fn())).toEqual({items: []});
    expect(fetch.mock.calls[0]?.[1].headers.get('Authorization')).toBe('Bearer session-token');
  });
  it('invalidates rejected sessions without exposing their token in the error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"Life2 token signature verification failed."}', {status:401})));
    const rejected = vi.fn();
    await expect(requestJson('/api/v1/dashboards', {}, 'rejected-token', rejected)).rejects.toMatchObject({status:401});
    expect(rejected).toHaveBeenCalledWith('rejected-token');
  });
  it('does not log out on forbidden, server, or network failures', async () => {
    for (const status of [403,503]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {status})));
      const rejected = vi.fn();
      await expect(requestJson('/api/v1/dashboards', {}, 'token', rejected)).rejects.toBeInstanceOf(ApiError);
      expect(rejected).not.toHaveBeenCalled();
    }
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network unavailable')));
    const rejected = vi.fn();
    await expect(requestJson('/api/v1/dashboards', {}, 'token', rejected)).rejects.toThrow('network unavailable');
    expect(rejected).not.toHaveBeenCalled();
  });
});
