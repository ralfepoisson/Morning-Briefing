export type ApiClient = (path: string, init?: RequestInit) => Promise<unknown>;

export interface RouteContext {
  api: ApiClient;
  container: HTMLElement;
  notify: (message: string, kind?: 'success' | 'error' | 'info') => void;
  navigate: (target: string) => void;
}

export interface LogFilters {
  q?: string;
  levels?: string[];
  limit?: number;
  range?: string;
}

export function createAdminController(context: RouteContext) {
  const mutation = async <T>(path: string, init: RequestInit, message: string): Promise<T> => {
    try {
      const result = await context.api(path, jsonInit(init));
      context.notify(message, 'success');
      return result as T;
    } catch (error) {
      context.notify(errorMessage(error, 'The admin operation failed.'), 'error');
      throw error;
    }
  };

  return {
    loadMessageBroker: () => context.api('/admin/message-broker'),
    loadUsers: () => context.api('/admin/users'),
    updateUserAccess: (userId: string, isAdmin: boolean) => mutation(
      `/admin/users/${encodeURIComponent(userId)}/access`,
      { method: 'PATCH', body: JSON.stringify({ isAdmin }) },
      'User access updated.'
    ),
    loadDashboards: () => context.api('/admin/dashboards'),
    regenerateDashboardAudio: (dashboardId: string) => mutation(
      `/admin/dashboards/${encodeURIComponent(dashboardId)}/regenerate-audio-briefing`,
      { method: 'POST' },
      'Audio briefing regeneration queued.'
    ),
    loadConfiguration: () => context.api('/admin/configuration'),
    updateConfiguration: (payload: { openAiModel: string }) => mutation(
      '/admin/configuration', { method: 'PATCH', body: JSON.stringify(payload) }, 'AI configuration updated.'
    ),
    loadConnectorInventory: () => context.api('/admin/connectors'),
    loadWidgets: () => context.api('/admin/widgets'),
    regenerateWidget: (widgetId: string) => mutation(
      `/admin/widgets/${encodeURIComponent(widgetId)}/regenerate-snapshot`,
      { method: 'POST', body: JSON.stringify({ bypassDuplicateCheck: true }) },
      'Widget snapshot regeneration queued.'
    ),
    regenerateAllWidgets: () => mutation(
      '/admin/widgets/regenerate-all-snapshots',
      { method: 'POST', body: JSON.stringify({ bypassDuplicateCheck: true }) },
      'Eligible widget snapshot regenerations queued.'
    ),
    loadLogs: (filters: LogFilters = {}) => context.api(logsPath(filters))
  };
}

export async function renderAdminRoute(context: RouteContext, path: string): Promise<void> {
  if (!await ensureAdmin(context)) return;
  const controller = createAdminController(context);
  const section = path.replace(/^.*\/admin\/?/, '') || 'message-broker';
  context.container.innerHTML = adminShell(section, '<p class="admin-loading">Loading…</p>');

  try {
    if (section === 'configuration') {
      const value = asRecord(await controller.loadConfiguration());
      const models = stringArray(value.availableOpenAiModels);
      context.container.innerHTML = adminShell(section, `<form data-admin-configuration>
        <p>OpenAI API key: ${value.hasOpenAiApiKey ? 'configured by protected host environment' : 'not configured in protected host environment'}.</p>
        <label>Model<select name="openAiModel">${models.map((model) => `<option${model === value.openAiModel ? ' selected' : ''}>${escapeHtml(model)}</option>`).join('')}</select></label>
        <button type="submit">Save configuration</button></form>`);
      context.container.querySelector<HTMLFormElement>('[data-admin-configuration]')?.addEventListener('submit', function (event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget as HTMLFormElement);
        const payload = { openAiModel: stringValue(data.get('openAiModel')) };
        void controller.updateConfiguration(payload);
      });
      return;
    }

    if (section === 'users') {
      const data = asRecord(await controller.loadUsers());
      const users = records(data.items);
      context.container.innerHTML = adminShell(section, table(['User', 'Email', 'Access', 'Action'], users.map((user) => [
        stringValue(user.displayName), stringValue(user.email), user.isAdmin ? 'Admin' : 'Member',
        `<button data-user-access="${escapeAttribute(stringValue(user.id))}" data-next-admin="${user.isAdmin ? 'false' : 'true'}">${user.isAdmin ? 'Remove admin' : 'Make admin'}</button>`
      ])));
      bindDelegated(context.container, '[data-user-access]', async (element) => {
        await controller.updateUserAccess(element.dataset.userAccess || '', element.dataset.nextAdmin === 'true');
        await renderAdminRoute(context, path);
      });
      return;
    }

    if (section === 'dashboards') {
      const data = asRecord(await controller.loadDashboards());
      const dashboards = records(data.items ?? data.dashboards);
      context.container.innerHTML = adminShell(section, table(['Dashboard', 'Owner', 'Widgets', 'Audio'], dashboards.map((dashboard) => [
        stringValue(dashboard.name), displayName(dashboard.owner), String(arrayValue(dashboard.widgets).length),
        `<button data-audio-dashboard="${escapeAttribute(stringValue(dashboard.id))}">Regenerate audio</button>`
      ])));
      bindDelegated(context.container, '[data-audio-dashboard]', (element) => controller.regenerateDashboardAudio(element.dataset.audioDashboard || ''));
      return;
    }

    if (section === 'connectors') {
      const data = await controller.loadConnectorInventory();
      const items = records(asRecord(data).items ?? data);
      context.container.innerHTML = adminShell(section, table(['Connector', 'Provider', 'Owner', 'Widgets'], items.map((item) => [
        stringValue(item.name), stringValue(item.type).toUpperCase(), displayName(item.owner), String(arrayValue(item.widgets).length)
      ])));
      return;
    }

    if (section === 'widgets') {
      const data = asRecord(await controller.loadWidgets());
      const widgets = records(data.items ?? data.widgets);
      context.container.innerHTML = adminShell(section, `<button data-regenerate-all>Regenerate all eligible</button>${table(['Widget', 'Dashboard', 'Status', 'Action'], widgets.map((widget) => [
        stringValue(widget.title), displayName(widget.dashboard), displayName(widget.latestSnapshot) || 'Pending',
        `<button data-regenerate-widget="${escapeAttribute(stringValue(widget.id))}">Regenerate</button>`
      ]))}`);
      bindDelegated(context.container, '[data-regenerate-widget]', (element) => controller.regenerateWidget(element.dataset.regenerateWidget || ''));
      context.container.querySelector('[data-regenerate-all]')?.addEventListener('click', () => { void controller.regenerateAllWidgets(); });
      return;
    }

    if (section === 'logs') {
      await renderLogs(context, controller);
      return;
    }

    const broker = asRecord(await controller.loadMessageBroker());
    context.container.innerHTML = adminShell('message-broker', `<pre class="admin-context">${escapeHtml(JSON.stringify(broker, null, 2))}</pre>`);
  } catch (error) {
    context.notify(errorMessage(error, 'Admin data is currently unavailable.'), 'error');
    context.container.innerHTML = adminShell(section, '<p role="alert">Admin data is currently unavailable.</p>');
  }
}

async function renderLogs(context: RouteContext, controller: ReturnType<typeof createAdminController>): Promise<void> {
  const filters: LogFilters = { levels: ['info', 'warn', 'error'], range: '30m', limit: 200 };
  const load = async () => {
    const data = asRecord(await controller.loadLogs(filters));
    const entries = records(data.items ?? data.entries);
    const totals = asRecord(asRecord(data.totals).filtered);
    const selectedLevels = filters.levels || [];
    context.container.innerHTML = adminShell('logs', `<p>Matching logs: ${entries.length}</p><form data-log-filters>
      <label for="log-search">Search logs</label><input id="log-search" name="q" type="search" value="${escapeAttribute(filters.q || '')}">
      <label for="log-range">Time range</label><select id="log-range" name="range">
        <option value="30m"${filters.range === '30m' ? ' selected' : ''}>Last 30 minutes</option>
        <option value="24h"${filters.range === '24h' ? ' selected' : ''}>Last 24 hours</option>
        <option value="7d"${filters.range === '7d' ? ' selected' : ''}>Last 7 days</option>
        <option value="all"${filters.range === 'all' ? ' selected' : ''}>All available logs</option>
      </select><button>Search</button></form>
      <div class="log-level-filters">${['info', 'warn', 'error'].map((level) => `<button type="button" data-log-level="${level}" aria-pressed="${selectedLevels.includes(level)}">${title(level)} (${stringValue(totals[level]) || '0'})</button>`).join('')}</div>
      ${table(['Time', 'Level', 'Scope', 'Message', 'Context'], entries.map((entry) => [
      stringValue(entry.timestamp), stringValue(entry.level), stringValue(entry.scope), stringValue(entry.message), `<button type="button" data-show-context>Show context</button><pre hidden>${escapeHtml(JSON.stringify(entry.context ?? {}, null, 2))}</pre>`
    ]))}`);
    context.container.querySelector<HTMLFormElement>('[data-log-filters]')?.addEventListener('submit', (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); filters.q = stringValue(data.get('q')); filters.range = stringValue(data.get('range')); void load();
    });
    context.container.querySelector<HTMLSelectElement>('#log-range')?.addEventListener('change', function () { filters.range = this.value; void load(); });
    bindDelegated(context.container, '[data-log-level]', (element) => {
      const level = element.dataset.logLevel || '';
      filters.levels = selectedLevels.includes(level) ? selectedLevels.filter((item) => item !== level) : [...selectedLevels, level];
      return load();
    });
    bindDelegated(context.container, '[data-show-context]', (element) => {
      const details = element.nextElementSibling as HTMLElement | null;
      if (details) details.hidden = false;
    });
  };
  await load();
}

async function ensureAdmin(context: RouteContext): Promise<boolean> {
  try {
    const result = asRecord(await context.api('/users/me'));
    const user = asRecord(result.user ?? result);
    if (user.isAdmin) return true;
  } catch (error) {
    context.notify(errorMessage(error, 'Unable to verify admin access.'), 'error');
    context.navigate('#/dashboard');
    return false;
  }
  context.notify('You need admin access to view that page.', 'error');
  context.navigate('#/dashboard');
  return false;
}

function logsPath(filters: LogFilters): string {
  const query = new URLSearchParams({ q: filters.q || '', levels: (filters.levels || ['info', 'warn', 'error']).join(','), limit: String(filters.limit || 200), range: filters.range || 'all' });
  return `/admin/logs?${query.toString()}`;
}

function jsonInit(init: RequestInit): RequestInit { return { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }; }
function adminShell(section: string, body: string): string { return `<section class="admin-page"><header><span>Admin</span><h1>${escapeHtml(title(section))}</h1></header>${body}</section>`; }
function title(value: string): string { return value.split('-').map((part) => part ? part[0]!.toUpperCase() + part.slice(1) : '').join(' '); }
function table(headers: string[], rows: string[][]): string { return `<div class="table-responsive"><table class="table"><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function bindDelegated(container: HTMLElement, selector: string, handler: (element: HTMLElement) => void | Promise<unknown>): void { container.querySelectorAll<HTMLElement>(selector).forEach((element) => element.addEventListener('click', () => { void handler(element); })); }
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function records(value: unknown): Array<Record<string, unknown>> { return Array.isArray(value) ? value.map(asRecord) : []; }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function stringValue(value: unknown): string { return typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }
function displayName(value: unknown): string { const record = asRecord(value); return stringValue(record.displayName ?? record.name ?? record.status ?? value); }
function escapeHtml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function escapeAttribute(value: string): string { return escapeHtml(value); }
function errorMessage(error: unknown, fallback: string): string { const record = asRecord(error); const data = asRecord(record.data); return stringValue(data.message ?? record.message) || fallback; }
