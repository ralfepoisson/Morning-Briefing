import type { RouteContext } from './admin.ts';

export interface ConnectorInput { type: string; credentials?: Record<string, string>; }
export interface ConnectorUpdate { name: string; credentials?: Record<string, string>; }
export type GoogleConnectorType = 'google-calendar' | 'gmail';

export function createConnectorsController(context: RouteContext, currentUrl: () => string = () => window.location.href) {
  const mutate = async <T>(path: string, init: RequestInit, success: string): Promise<T> => {
    try { const value = await context.api(path, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }); context.notify(success, 'success'); return value as T; }
    catch (error) { context.notify(errorMessage(error, 'The connector operation failed.'), 'error'); throw error; }
  };
  return {
    async list(type?: string): Promise<Record<string, unknown>[]> {
      const response = record(await context.api(`/connections${type ? `?type=${encodeURIComponent(type)}` : ''}`));
      return records(response.items);
    },
    create(input: ConnectorInput) {
      return mutate<Record<string, unknown>>('/connections', { method: 'POST', body: JSON.stringify({ type: input.type, credentials: input.credentials || {} }) }, 'Connector created.');
    },
    update(id: string, input: ConnectorUpdate) {
      return mutate<Record<string, unknown>>(`/connections/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name: input.name, credentials: input.credentials || {} }) }, 'Connector details saved.');
    },
    async startOAuth(type: GoogleConnectorType, connectionId = ''): Promise<string> {
      const response = record(await context.api(`/connections/${type}/oauth/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnTo: currentUrl(), connectionId })
      }));
      const authorizationUrl = text(response.authorizationUrl);
      if (!authorizationUrl) throw new Error('Google OAuth could not be started.');
      context.navigate(authorizationUrl);
      return authorizationUrl;
    }
  };
}

export async function renderConnectorsRoute(context: RouteContext): Promise<void> {
  const controller = createConnectorsController(context);
  let connectors: Record<string, unknown>[] = [];
  try { connectors = await controller.list(); }
  catch (error) { context.notify(errorMessage(error, 'Connectors are currently unavailable.'), 'error'); }
  draw();

  function draw(): void {
    context.container.innerHTML = `<section class="connectors-page"><header><span>Connectors</span><h1>Connections</h1><p>Manage provider credentials and reconnect Google services.</p></header>
      <form data-create-connector><label>Provider<select name="type"><option value="todoist">Todoist</option><option value="openai">OpenAI</option></select></label><label>API key<input name="apiKey" type="password" required></label><button>Create connector</button></form>
      <div class="connector-list">${connectors.map(card).join('') || '<p>No connectors found.</p>'}</div></section>`;
    context.container.querySelector<HTMLFormElement>('[data-create-connector]')?.addEventListener('submit', async function (event) {
      event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement);
      try { await controller.create({ type: text(data.get('type')), credentials: { apiKey: text(data.get('apiKey')) } }); connectors = await controller.list(); draw(); } catch { /* controller notified */ }
    });
    context.container.querySelectorAll<HTMLFormElement>('[data-update-connector]').forEach((form) => form.addEventListener('submit', async function (event) {
      event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); const credentials: Record<string, string> = {};
      for (const key of ['apiKey', 'calendarId', 'model', 'baseUrl']) { const value = text(data.get(key)); if (value) credentials[key] = value; }
      try { await controller.update(form.dataset.updateConnector || '', { name: text(data.get('name')), credentials }); connectors = await controller.list(); draw(); } catch { /* controller notified */ }
    }));
    context.container.querySelectorAll<HTMLElement>('[data-oauth-type]').forEach((button) => button.addEventListener('click', () => {
      const type = button.dataset.oauthType; if (type === 'google-calendar' || type === 'gmail') void controller.startOAuth(type, button.dataset.connectorId || '').catch((error) => context.notify(errorMessage(error, 'Unable to start Google OAuth.'), 'error'));
    }));
  }
}

function card(connector: Record<string, unknown>): string {
  const id = text(connector.id); const type = text(connector.type); const config = record(connector.config);
  const providerFields = type === 'google-calendar' ? input('Calendar ID', 'calendarId', text(config.calendarId)) : type === 'openai' ? `${input('Model', 'model', text(config.model))}${input('Base URL', 'baseUrl', text(config.baseUrl))}` : '';
  const credentialField = type === 'todoist' || type === 'openai' ? input('Replacement API key', 'apiKey', '', 'password') : '';
  const oauth = type === 'google-calendar' || type === 'gmail' ? `<button type="button" data-oauth-type="${type}" data-connector-id="${escapeAttribute(id)}">Reconnect Google</button>` : '';
  return `<article class="connector-card"><h2>${escapeHtml(text(connector.name) || type)}</h2><p>${escapeHtml(type.toUpperCase())} · ${escapeHtml(text(connector.status))}</p><form data-update-connector="${escapeAttribute(id)}">${input('Name', 'name', text(connector.name))}${credentialField}${providerFields}<button>Save changes</button>${oauth}</form></article>`;
}
function input(label: string, name: string, value: string, type = 'text'): string { return `<label>${label}<input name="${name}" type="${type}" value="${escapeAttribute(value)}"></label>`; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function records(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.map(record) : []; }
function text(value: unknown): string { return typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }
function escapeHtml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function escapeAttribute(value: string): string { return escapeHtml(value); }
function errorMessage(error: unknown, fallback: string): string { const value = record(error); const data = record(value.data); return text(data.message ?? value.message) || fallback; }
