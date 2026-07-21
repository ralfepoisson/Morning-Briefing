import { describe, expect, it, vi } from 'vitest';
import { createRssController, type RssCategory } from './rss.ts';
import type { RouteContext } from './admin.ts';

describe('RSS route controller', function () {
  it('imports legacy local categories when the backend is empty', async function () {
    const calls: string[] = [];
    const storage = memoryStorage({ 'morningBriefing.rssFeeds': JSON.stringify([{ id: 'old', name: 'Tech', description: '', feeds: [{ id: 'f', name: 'Example', url: 'https://example.test/rss' }] }]) });
    const context = makeContext(async function (path) {
      calls.push(path);
      if (path === '/rss-feeds' && calls.filter((item) => item === path).length === 1) return { items: [] };
      if (path === '/rss-feeds/categories') return { id: 'new-category' };
      return { items: [{ id: 'new-category', name: 'Tech', description: '', feeds: [] }] };
    });
    const rss = createRssController(context, storage);
    const categories = await rss.list();

    expect(categories[0]?.name).toBe('Tech');
    expect(calls).toContain('/rss-feeds/categories/new-category/feeds');
    expect(storage.getItem('morningBriefing.rssFeeds')).toBeNull();
  });

  it('falls back to validated local CRUD when the backend is unavailable', async function () {
    const storage = memoryStorage();
    const rss = createRssController(makeContext(async function () { throw new Error('offline'); }), storage);
    await rss.list();
    const category = await rss.createCategory({ name: 'World', description: 'News' });
    const withFeed = await rss.addFeed(category.id, { name: 'Example', url: 'https://example.test/rss' });
    expect(withFeed.feeds).toHaveLength(1);
    await expect(rss.addFeed(category.id, { name: 'Bad', url: 'javascript:alert(1)' })).rejects.toThrow(/valid feed URL/);
    await rss.removeFeed(category.id, withFeed.feeds[0]!.id);
    await rss.deleteCategory(category.id);
    expect(await rss.list()).toEqual([]);
  });
});

function makeContext(api: RouteContext['api']): RouteContext {
  return { api, container: { innerHTML: '' } as HTMLElement, notify: vi.fn(), navigate: vi.fn() };
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; }, clear() { values.clear(); }, getItem(key) { return values.get(key) ?? null; },
    key(index) { return [...values.keys()][index] ?? null; }, removeItem(key) { values.delete(key); }, setItem(key, value) { values.set(key, value); }
  };
}
