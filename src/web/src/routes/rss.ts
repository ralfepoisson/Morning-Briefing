import type { RouteContext } from './admin.ts';

const STORAGE_KEY = 'morningBriefing.rssFeeds';

export interface RssFeed {
  id: string;
  name: string;
  url: string;
}

export interface RssCategory {
  id: string;
  name: string;
  description: string;
  feeds: RssFeed[];
}

export interface RssCategoryInput { name: string; description?: string; }
export interface RssFeedInput { name: string; url: string; }

export function createRssController(
  context: RouteContext,
  storage: Storage = window.localStorage
) {
  let useLocalStorage = false;

  const localCategories = (): RssCategory[] => parseCategories(storage.getItem(STORAGE_KEY));
  const saveLocal = (categories: RssCategory[]): RssCategory[] => {
    storage.setItem(STORAGE_KEY, JSON.stringify(categories));
    return categories;
  };
  const switchToLocal = (error: unknown): void => {
    useLocalStorage = true;
    context.notify(errorMessage(error, 'RSS storage is unavailable. Changes will be kept in this browser.'), 'info');
  };

  const listBackend = async (): Promise<RssCategory[]> => {
    const response = await context.api('/rss-feeds');
    return categoriesFromResponse(response);
  };

  const list = async (): Promise<RssCategory[]> => {
    if (useLocalStorage) return localCategories();
    try {
      const categories = await listBackend();
      const legacy = localCategories();
      if (categories.length > 0 || legacy.length === 0) return categories;

      for (const category of legacy) {
        const created = record(await context.api('/rss-feeds/categories', jsonRequest('POST', {
          name: category.name,
          description: category.description
        })));
        const categoryId = text(created.id);
        if (!categoryId) throw new Error(`The RSS category "${category.name}" was not imported.`);
        for (const feed of category.feeds) {
          await context.api(`/rss-feeds/categories/${encodeURIComponent(categoryId)}/feeds`, jsonRequest('POST', {
            name: feed.name,
            url: feed.url
          }));
        }
      }
      storage.removeItem(STORAGE_KEY);
      context.notify('Browser RSS feeds were imported to your account.', 'success');
      return await listBackend();
    } catch (error) {
      switchToLocal(error);
      return localCategories();
    }
  };

  return {
    list,
    async createCategory(input: RssCategoryInput): Promise<RssCategory> {
      const normalized = normalizeCategoryInput(input);
      if (!useLocalStorage) {
        try {
          const result = record(await context.api('/rss-feeds/categories', jsonRequest('POST', normalized)));
          context.notify('RSS category created.', 'success');
          return categoryFromRecord(result);
        } catch (error) { switchToLocal(error); }
      }
      const categories = localCategories();
      if (categories.some((category) => category.name.toLocaleLowerCase() === normalized.name.toLocaleLowerCase())) throw new Error('An RSS category with that name already exists.');
      const category: RssCategory = { id: identifier(), ...normalized, feeds: [] };
      saveLocal([...categories, category]);
      return category;
    },
    async updateCategory(categoryId: string, input: RssCategoryInput): Promise<RssCategory> {
      const normalized = normalizeCategoryInput(input);
      if (!useLocalStorage) {
        try {
          const result = record(await context.api(`/rss-feeds/categories/${encodeURIComponent(categoryId)}`, jsonRequest('PATCH', normalized)));
          context.notify('RSS category updated.', 'success');
          return categoryFromRecord(result);
        } catch (error) { switchToLocal(error); }
      }
      const categories = localCategories();
      if (categories.some((category) => category.id !== categoryId && category.name.toLocaleLowerCase() === normalized.name.toLocaleLowerCase())) throw new Error('An RSS category with that name already exists.');
      const existing = requireCategory(categories, categoryId);
      const updated = { ...existing, ...normalized };
      saveLocal(categories.map((category) => category.id === categoryId ? updated : category));
      return updated;
    },
    async deleteCategory(categoryId: string): Promise<void> {
      if (!useLocalStorage) {
        try {
          await context.api(`/rss-feeds/categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' });
          context.notify('RSS category deleted.', 'success');
          return;
        } catch (error) { switchToLocal(error); }
      }
      const categories = localCategories();
      requireCategory(categories, categoryId);
      saveLocal(categories.filter((category) => category.id !== categoryId));
    },
    async addFeed(categoryId: string, input: RssFeedInput): Promise<RssCategory> {
      const normalized = normalizeFeedInput(input);
      if (!useLocalStorage) {
        try {
          await context.api(`/rss-feeds/categories/${encodeURIComponent(categoryId)}/feeds`, jsonRequest('POST', normalized));
          context.notify('RSS feed added.', 'success');
          const categories = await listBackend();
          return requireCategory(categories, categoryId);
        } catch (error) { switchToLocal(error); }
      }
      const categories = localCategories();
      const existing = requireCategory(categories, categoryId);
      if (existing.feeds.some((feed) => feed.url.toLocaleLowerCase() === normalized.url.toLocaleLowerCase())) throw new Error('That RSS feed is already in this category.');
      const updated = { ...existing, feeds: [...existing.feeds, { id: identifier(), ...normalized }] };
      saveLocal(categories.map((category) => category.id === categoryId ? updated : category));
      return updated;
    },
    async removeFeed(categoryId: string, feedId: string): Promise<RssCategory> {
      if (!useLocalStorage) {
        try {
          await context.api(`/rss-feeds/categories/${encodeURIComponent(categoryId)}/feeds/${encodeURIComponent(feedId)}`, { method: 'DELETE' });
          context.notify('RSS feed removed.', 'success');
          const categories = await listBackend();
          return requireCategory(categories, categoryId);
        } catch (error) { switchToLocal(error); }
      }
      const categories = localCategories();
      const existing = requireCategory(categories, categoryId);
      if (!existing.feeds.some((feed) => feed.id === feedId)) throw new Error('RSS feed not found.');
      const updated = { ...existing, feeds: existing.feeds.filter((feed) => feed.id !== feedId) };
      saveLocal(categories.map((category) => category.id === categoryId ? updated : category));
      return updated;
    }
  };
}

export async function renderRssRoute(context: RouteContext): Promise<void> {
  const controller = createRssController(context);
  let categories: RssCategory[] = [];
  try { categories = await controller.list(); }
  catch (error) { context.notify(errorMessage(error, 'RSS feeds are currently unavailable.'), 'error'); }
  draw();

  function draw(): void {
    context.container.innerHTML = `<section class="rss-page"><header><span>Sources</span><h1>RSS feeds</h1><p>Organise the news sources used by your briefing.</p></header>
      <form data-create-category><label>Category name<input name="name" required></label><label>Description<input name="description"></label><button>Create category</button></form>
      <div class="rss-categories">${categories.map(categoryCard).join('') || '<p>No RSS categories yet.</p>'}</div></section>`;
    context.container.querySelector<HTMLFormElement>('[data-create-category]')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement);
      try { await controller.createCategory({ name: text(data.get('name')), description: text(data.get('description')) }); await reload(); }
      catch (error) { context.notify(errorMessage(error, 'The RSS category could not be created.'), 'error'); }
    });
    context.container.querySelectorAll<HTMLFormElement>('[data-category-form]').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); const categoryId = form.dataset.categoryForm || '';
      try { await controller.updateCategory(categoryId, { name: text(data.get('name')), description: text(data.get('description')) }); await reload(); }
      catch (error) { context.notify(errorMessage(error, 'The RSS category could not be updated.'), 'error'); }
    }));
    context.container.querySelectorAll<HTMLFormElement>('[data-feed-form]').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); const categoryId = form.dataset.feedForm || '';
      try { await controller.addFeed(categoryId, { name: text(data.get('name')), url: text(data.get('url')) }); await reload(); }
      catch (error) { context.notify(errorMessage(error, 'The RSS feed could not be added.'), 'error'); }
    }));
    context.container.querySelectorAll<HTMLElement>('[data-delete-category]').forEach((button) => button.addEventListener('click', async () => {
      try { await controller.deleteCategory(button.dataset.deleteCategory || ''); await reload(); }
      catch (error) { context.notify(errorMessage(error, 'The RSS category could not be deleted.'), 'error'); }
    }));
    context.container.querySelectorAll<HTMLElement>('[data-remove-feed]').forEach((button) => button.addEventListener('click', async () => {
      try { await controller.removeFeed(button.dataset.categoryId || '', button.dataset.removeFeed || ''); await reload(); }
      catch (error) { context.notify(errorMessage(error, 'The RSS feed could not be removed.'), 'error'); }
    }));
  }

  async function reload(): Promise<void> { categories = await controller.list(); draw(); }
}

function categoryCard(category: RssCategory): string {
  return `<article class="rss-category"><form data-category-form="${escapeAttribute(category.id)}"><input name="name" value="${escapeAttribute(category.name)}" required><input name="description" value="${escapeAttribute(category.description)}"><button>Save</button><button type="button" data-delete-category="${escapeAttribute(category.id)}">Delete category</button></form>
    <ul>${category.feeds.map((feed) => `<li><a href="${escapeAttribute(feed.url)}" rel="noreferrer">${escapeHtml(feed.name)}</a><button type="button" data-category-id="${escapeAttribute(category.id)}" data-remove-feed="${escapeAttribute(feed.id)}">Remove</button></li>`).join('') || '<li>No feeds in this category.</li>'}</ul>
    <form data-feed-form="${escapeAttribute(category.id)}"><input name="name" placeholder="Feed name" required><input name="url" type="url" placeholder="https://example.com/rss" required><button>Add feed</button></form></article>`;
}

function categoriesFromResponse(value: unknown): RssCategory[] {
  const response = record(value);
  const items = Array.isArray(response.items) ? response.items : Array.isArray(value) ? value : [];
  return items.map((item) => categoryFromRecord(record(item)));
}
function categoryFromRecord(value: Record<string, unknown>): RssCategory {
  return { id: text(value.id), name: text(value.name), description: text(value.description), feeds: Array.isArray(value.feeds) ? value.feeds.map((feed) => feedFromRecord(record(feed))) : [] };
}
function feedFromRecord(value: Record<string, unknown>): RssFeed { return { id: text(value.id), name: text(value.name), url: text(value.url) }; }
function parseCategories(value: string | null): RssCategory[] {
  if (!value) return [];
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.map((item) => categoryFromRecord(record(item))).filter((item) => item.id && item.name) : []; }
  catch { return []; }
}
function normalizeCategoryInput(input: RssCategoryInput): { name: string; description: string } {
  const name = input.name.trim(); if (!name) throw new Error('Enter a category name.');
  return { name, description: (input.description || '').trim() };
}
function normalizeFeedInput(input: RssFeedInput): { name: string; url: string } {
  const name = input.name.trim(); if (!name) throw new Error('Enter a feed name.');
  let url: URL; try { url = new URL(input.url.trim()); } catch { throw new Error('Enter a valid feed URL.'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Enter a valid feed URL using HTTP or HTTPS.');
  return { name, url: url.toString() };
}
function requireCategory(categories: RssCategory[], id: string): RssCategory { const category = categories.find((item) => item.id === id); if (!category) throw new Error('RSS category not found.'); return category; }
function jsonRequest(method: string, body: unknown): RequestInit { return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
function identifier(): string { return globalThis.crypto?.randomUUID?.() || `rss-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown): string { return typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }
function escapeHtml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function escapeAttribute(value: string): string { return escapeHtml(value); }
function errorMessage(error: unknown, fallback: string): string { const value = record(error); const data = record(value.data); return text(data.message ?? value.message) || fallback; }
