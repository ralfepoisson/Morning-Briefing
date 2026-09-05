import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../assets/styles/main.css';
import './modern.css';
import { buildSignInUrl, parseToken, type Session } from './auth.ts';
import { ApiError, requestJson } from './http.ts';
import { DashboardStore, type Widget } from './dashboard-store.ts';
import { renderAdminRoute, type RouteContext } from './routes/admin.ts';
import { renderConnectorsRoute } from './routes/connectors.ts';
import { renderProfileRoute } from './routes/profile.ts';
import { renderRssRoute } from './routes/rss.ts';

declare global {
  interface Window {
    __MORNING_BRIEFING_CONFIG__?: Partial<RuntimeConfig>;
  }
}

interface RuntimeConfig {
  apiBaseUrl: string;
  authServiceSignInUrl: string;
  authServiceApplicationId: string;
  authServiceSignOutUrl: string;
  appBaseUrl: string;
}

interface Dashboard {
  id: string;
  name: string;
  description?: string;
}

interface Connection {
  id: string;
  type: string;
  name: string;
}

const TOKEN_KEY = 'morningBriefing.auth.token';
const SESSION_KEY = 'morningBriefing.auth.session';
const RETURN_PATH_KEY = 'morningBriefing.auth.returnPath';
const ERROR_KEY = 'morningBriefing.auth.error';
const OAUTH_CONTEXT_KEY = 'morningBriefing.widgetOAuthContext';
const config: RuntimeConfig = {
  apiBaseUrl: window.__MORNING_BRIEFING_CONFIG__?.apiBaseUrl || '/api/v1',
  authServiceSignInUrl: window.__MORNING_BRIEFING_CONFIG__?.authServiceSignInUrl || 'https://auth.life-sqrd.com/signIn',
  authServiceApplicationId: window.__MORNING_BRIEFING_CONFIG__?.authServiceApplicationId || '39863fc2-c2b9-4b5f-82ee-04841b2e9980',
  authServiceSignOutUrl: window.__MORNING_BRIEFING_CONFIG__?.authServiceSignOutUrl || '',
  appBaseUrl: window.__MORNING_BRIEFING_CONFIG__?.appBaseUrl || `${window.location.origin}/`
};
const app = requiredElement<HTMLDivElement>('#app');
const store = new DashboardStore();
let session = restoreSession();
let dashboards: Dashboard[] = [];
let activeDashboard: Dashboard | null = null;
let editing = false;
let refreshing = false;
let widgetModalId = '';
let connectionModalWidgetId = '';
let widgetPanelOpen = false;
let autoRefreshTimer: number | undefined;

captureIncomingToken();
window.addEventListener('hashchange', function () { void route(); });
void route();

/** Ensure failed route loads always leave a usable page. */
async function route(): Promise<void> {
  try {
    await renderRoute();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return;
    renderShell('<section role="alert"><h1>Unable to load this page</h1><p>The service could not complete the request. Please try again.</p><button class="btn btn-primary" id="retry-route">Try again</button></section>');
    requiredElement('#retry-route').addEventListener('click', () => { void route(); });
  }
}

async function renderRoute(): Promise<void> {
  window.clearTimeout(autoRefreshTimer);
  const path = hashPath();
  if (path === '/auth/callback') {
    captureIncomingToken();
    if (session) {
      window.location.hash = '#/dashboard';
    } else {
      window.location.hash = '#/signed-out';
    }
    return;
  }
  if (!session && !isPublic(path)) {
    beginSignIn(path);
    return;
  }
  if (session && (path === '/' || path === '/signed-out')) {
    await renderDashboard();
    return;
  }
  if (path === '/' || path === '/terms' || path === '/privacy' || path === '/contact' || path === '/signed-out') {
    renderPublic(path);
    return;
  }
  if (path === '/dashboard') {
    await renderDashboard();
    return;
  }
  if (path === '/profile') {
    await renderFeatureRoute(renderProfileRoute);
    return;
  }
  if (path === '/connectors') {
    await renderFeatureRoute(renderConnectorsRoute);
    return;
  }
  if (path === '/rss-feeds') {
    await renderFeatureRoute(renderRssRoute);
    return;
  }
  if (path.startsWith('/admin')) {
    await renderFeatureRoute((context) => renderAdminRoute(context, path));
    return;
  }
  renderShell('<section><h1>Page not found</h1><p>The requested Morning Briefing page does not exist.</p></section>');
}

function renderShell(content: string): void {
  app.innerHTML = `${navigation()}<main class="app-shell container-fluid px-3 px-lg-4 py-4">${content}</main><div id="notifications" aria-live="polite"></div>`;
  bindNavigation();
}

function navigation(): string {
  return `<nav class="top-nav navbar navbar-expand-lg" aria-label="Primary navigation"><div class="container-fluid">
    <a class="navbar-brand" href="#/"><img class="brand-logo" src="/assets/img/logo-dark.png" alt="Morning Briefing logo"></a>
    <div class="top-nav-links d-flex align-items-center gap-2 ms-auto">
      <a class="nav-link" href="#/">Home</a><a class="nav-link" href="#/terms">Terms</a><a class="nav-link" href="#/privacy">Privacy</a><a class="nav-link" href="#/contact">Contact</a>
      ${session ? `<a class="nav-link" href="#/connectors">Connectors</a><a class="nav-link" href="#/rss-feeds">RSS Feeds</a><a class="nav-link" href="#/admin/logs">Admin</a><button class="btn btn-sm btn-outline-secondary" id="sign-out">Sign out</button>` : '<button class="btn btn-sm btn-primary" id="nav-sign-in">Sign in</button>'}
    </div></div></nav>`;
}

function bindNavigation(): void {
  document.querySelector('#nav-sign-in')?.addEventListener('click', function () { beginSignIn('/dashboard'); });
  document.querySelector('#sign-out')?.addEventListener('click', function () {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SESSION_KEY); session = null; window.location.hash = '#/signed-out';
  });
}

function renderPublic(path: string): void {
  if (path === '/terms') {
    renderShell('<section class="public-page"><h1>Terms of Service</h1><p>Last updated: March 30, 2026</p><p>You may not misuse the service or attempt to access data that is not yours.</p></section>');
    return;
  }
  if (path === '/privacy') {
    renderShell('<section class="public-page"><h1>Privacy Policy</h1><p>Daily Briefing acts as the data controller for information submitted directly to this service.</p><p>Your rights include access, rectification, erasure, restriction, and portability.</p></section>');
    return;
  }
  if (path === '/contact') {
    renderShell(`<section class="public-page"><h1>Contact Us</h1><form id="contact-form" class="public-contact-form">
      ${field('Name', 'contact-name')} ${field('Email', 'contact-email', 'email')} ${field('Subject', 'contact-subject')}
      <label for="contact-message">Message</label><textarea id="contact-message" class="form-control" required></textarea>
      <button class="btn btn-primary mt-3" type="submit">Send message</button></form><p id="contact-result"></p></section>`);
    requiredElement<HTMLFormElement>('#contact-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      await api('/public/contact', { method: 'POST', body: JSON.stringify({
        name: inputValue('#contact-name'), email: inputValue('#contact-email'), subject: inputValue('#contact-subject'), message: inputValue('#contact-message')
      }) });
      requiredElement('#contact-result').textContent = 'Thanks, your message has been sent.';
    });
    return;
  }
  if (path === '/signed-out') {
    renderShell(`<section class="auth-status"><h1>Authentication is required</h1><p>${escapeHtml(localStorage.getItem(ERROR_KEY) || 'Sign in to continue.')}</p><button class="btn btn-primary" id="main-sign-in">Sign in</button></section>`);
    requiredElement('#main-sign-in').addEventListener('click', function () { beginSignIn('/dashboard'); });
    return;
  }
  renderShell(`<section class="public-home"><h1>Daily Briefing for calmer mornings</h1><p>One focused dashboard for weather, calendars, tasks, email, and the news that matters.</p><button class="btn btn-primary" id="main-sign-in">Sign in</button></section>`);
  requiredElement('#main-sign-in').addEventListener('click', function () { beginSignIn('/dashboard'); });
}

async function renderDashboard(): Promise<void> {
  renderShell('<section class="dashboard-stage"><p>Loading dashboard…</p></section>');
  const dashboardResponse = await api<{ items: Dashboard[] }>('/dashboards');
  dashboards = dashboardResponse.items || [];
  activeDashboard = dashboards[0] || null;
  if (!activeDashboard) {
    renderShell('<section class="dashboard-stage"><h1>No dashboards yet</h1></section>');
    return;
  }
  const dashboardId = activeDashboard.id;
  const [widgetsResponse] = await Promise.all([
    api<{ items: Widget[] }>(`/dashboards/${dashboardId}/widgets`),
    api(`/dashboards/${dashboardId}/audio-briefing/preferences`).catch(() => null),
    api(`/dashboards/${dashboardId}/audio-briefing`).catch(() => null)
  ]);
  store.replace(widgetsResponse.items || []);
  await loadSnapshot(dashboardId);
  if (!session) return;
  await restoreOAuthResult();
  if (!session) return;
  drawDashboard();
  scheduleAutoRefresh();
}

function drawDashboard(): void {
  if (!activeDashboard) return;
  renderShell(`<section class="dashboard-stage">
    <header class="stage-header"><div><span>Dashboard</span><h1 class="stage-title">${escapeHtml(activeDashboard.name)}</h1><p>${escapeHtml(activeDashboard.description || '')}</p></div>
    <div class="stage-actions"><button class="btn btn-outline-light" aria-label="Refresh dashboard" id="refresh-dashboard" ${refreshing ? 'disabled' : ''}><i class="fa-solid ${refreshing ? 'fa-spinner fa-spin' : 'fa-rotate-right'}"></i></button>
    <button class="btn btn-primary" id="toggle-edit">${editing ? 'Save Dashboard' : 'Edit Dashboard'}</button>${editing ? '<button class="btn btn-outline-light" id="add-widget">+ Widget</button>' : ''}</div></header>
    <div class="dashboard-canvas">${store.list().map(renderWidget).join('') || '<h3>Blank dashboard</h3>'}</div>
    ${widgetPanelOpen ? widgetPanel() : ''}${widgetModalId ? widgetModal() : ''}${connectionModalWidgetId ? connectionModal() : ''}
  </section>`);
  bindDashboardEvents();
}

function renderWidget(widget: Widget): string {
  const label = widget.type === 'calendar' ? 'Calendar widget' : `${capitalize(widget.type)} widget`;
  const content = renderWidgetContent(widget);
  return `<article class="widget-card widget-card--${escapeHtml(widget.type)}" data-widget-id="${escapeHtml(widget.id)}" style="transform:translate(${widget.x}px, ${widget.y}px);width:${widget.width}px;height:${widget.height}px">
    <button class="refresh-widget" aria-label="Refresh widget snapshot"></button><div class="widget-card__header"><div><span>${label}</span><h3>${escapeHtml(widget.title)}</h3></div>${editing ? '<button class="configure-widget" aria-label="Configure widget"><i class="fa-solid fa-gear"></i></button>' : ''}</div>
    <div class="widget-card__body">${content}</div>${widget.generatedAt ? `<footer>Snapshot: ${new Date(widget.generatedAt).toLocaleString()}</footer>` : ''}
    ${editing ? '<div class="widget-resize-handle" aria-label="Resize widget"></div>' : ''}</article>`;
}

function renderWidgetContent(widget: Widget): string {
  const data = widget.data || {};
  if (widget.type === 'calendar') return `<div>Connection: <strong>${escapeHtml(String(data.connectionLabel || 'Not connected'))}</strong></div><div>${escapeHtml(String(data.dateLabel || 'Today'))}</div><p>${escapeHtml(String(data.emptyMessage || 'No appointments scheduled.'))}</p>`;
  if (widget.type === 'email') return `<div>Connection: <strong>${escapeHtml(String(data.connectionLabel || 'Not connected'))}</strong></div><p>${escapeHtml(String(data.emptyMessage || 'No messages.'))}</p>`;
  if (widget.type === 'tasks') return `<div>Connection: <strong>${escapeHtml(String(data.connectionLabel || 'Not connected'))}</strong></div><p>${escapeHtml(String(data.emptyMessage || 'No tasks.'))}</p>`;
  if (widget.type === 'weather') return `<h4>${escapeHtml(String(data.location || ''))}</h4><strong>${escapeHtml(String(data.temperature || ''))}</strong><p>${escapeHtml(String(data.summary || ''))}</p>`;
  return `<p>${escapeHtml(String(data.emptyMessage || 'Content is loading.'))}</p>`;
}

function bindDashboardEvents(): void {
  requiredElement('#refresh-dashboard').addEventListener('click', function () { void refreshDashboard(); });
  requiredElement('#toggle-edit').addEventListener('click', function () { void toggleEditing(); });
  document.querySelector('#add-widget')?.addEventListener('click', function () { widgetPanelOpen = true; drawDashboard(); });
  document.querySelectorAll<HTMLElement>('.configure-widget').forEach(function (button) {
    button.addEventListener('click', function () { widgetModalId = requiredWidgetCard(button).dataset.widgetId || ''; drawDashboard(); void loadModalConnections(); });
  });
  document.querySelector('#add-task-widget')?.addEventListener('click', function () { void addWidget('tasks'); });
  document.querySelector('#close-widget-panel')?.addEventListener('click', function () { widgetPanelOpen = false; drawDashboard(); });
  bindWidgetModal();
  bindConnectionModal();
  if (editing) bindDragAndResize();
}

async function toggleEditing(): Promise<void> {
  if (!editing) { editing = true; drawDashboard(); return; }
  if (!activeDashboard) return;
  await Promise.all(store.list().map((widget) => api(`/dashboards/${activeDashboard!.id}/widgets/${widget.id}`, {
    method: 'PATCH', body: JSON.stringify({ x: widget.x, y: widget.y, width: widget.width, height: widget.height, config: widget.config, includeInBriefingOverride: widget.includeInBriefingOverride })
  })));
  editing = false; drawDashboard(); scheduleAutoRefresh();
}

async function refreshDashboard(): Promise<void> {
  if (!activeDashboard || refreshing) return;
  refreshing = true; drawDashboard();
  const response = await api<{ items: Widget[] }>(`/dashboards/${activeDashboard.id}/widgets`);
  store.replace(response.items || []);
  await loadSnapshot(activeDashboard.id);
  refreshing = false; if (!session) return; drawDashboard(); scheduleAutoRefresh();
}

async function loadSnapshot(dashboardId: string): Promise<void> {
  const snapshot = await api<{ widgets?: Array<{ widgetId: string; content?: Record<string, unknown>; generatedAt?: string; errorMessage?: string | null }> }>(`/dashboards/${dashboardId}/snapshots/latest`).catch(() => null);
  store.applySnapshot(snapshot);
}

function scheduleAutoRefresh(): void {
  window.clearTimeout(autoRefreshTimer);
  if (!editing) autoRefreshTimer = window.setTimeout(function () { void refreshDashboard(); }, 15 * 60 * 1000);
}

function widgetPanel(): string {
  return `<aside class="widget-panel"><h2>Add a widget</h2><button id="close-widget-panel">Close widget panel</button><button id="add-task-widget" aria-label="Task list">Task list</button></aside>`;
}

function widgetModal(): string {
  const widget = store.get(widgetModalId);
  if (!widget) return '';
  const title = widget.type === 'tasks' ? 'Configure Task List' : widget.type === 'email' ? 'Configure Email' : widget.type === 'calendar' ? 'Configure Calendar' : `Configure ${capitalize(widget.type)}`;
  const checked = widget.includeInBriefingOverride ?? widget.includeInBriefing ?? widget.includeInBriefingDefault ?? true;
  return `<div class="modal-backdrop-custom"><section class="widget-config-modal"><h2>${title}</h2>
    <label><input id="include-audio" type="checkbox" ${checked ? 'checked' : ''}> Include in Audio Briefing</label>
    <div id="selected-connection">${widget.config.connectionName ? `Selected connection: ${escapeHtml(String(widget.config.connectionName))}` : ''}</div>
    ${widget.type === 'tasks' ? '<button id="new-connection">Create new connection</button>' : ''}
    ${shouldReconnect(widget) ? '<p>Google access for this widget needs to be refreshed.</p><button id="reconnect-google">Reconnect Google</button>' : ''}
    <button class="btn btn-primary" id="save-widget-config">Save</button><button id="close-widget-config">Close</button></section></div>`;
}

function bindWidgetModal(): void {
  if (!widgetModalId) return;
  document.querySelector('#close-widget-config')?.addEventListener('click', function () { widgetModalId = ''; drawDashboard(); });
  document.querySelector('#save-widget-config')?.addEventListener('click', function () {
    const widget = store.get(widgetModalId); const checkbox = document.querySelector<HTMLInputElement>('#include-audio');
    if (widget && checkbox) widget.includeInBriefingOverride = checkbox.checked;
    widgetModalId = ''; drawDashboard();
  });
  document.querySelector('#new-connection')?.addEventListener('click', function () { connectionModalWidgetId = widgetModalId; widgetModalId = ''; drawDashboard(); });
  document.querySelector('#reconnect-google')?.addEventListener('click', function () { void reconnectGoogle(); });
}

function connectionModal(): string {
  return `<div class="modal-backdrop-custom"><section class="connection-modal"><h2>New connection</h2><label for="todoist-key">Todoist API Key</label><input id="todoist-key" class="form-control"><button id="save-connection">Save</button></section></div>`;
}

function bindConnectionModal(): void {
  document.querySelector('#save-connection')?.addEventListener('click', function () { void saveConnection(); });
}

async function saveConnection(): Promise<void> {
  const connection = await api<Connection>('/connections', { method: 'POST', body: JSON.stringify({ type: 'todoist', credentials: { apiKey: inputValue('#todoist-key') } }) });
  const widget = store.get(connectionModalWidgetId);
  if (widget) {
    widget.config.connectionId = connection.id; widget.config.connectionName = connection.name; widget.config.provider = connection.type;
    widget.data = { provider: connection.type, connectionLabel: connection.name, emptyMessage: 'Tasks are still loading or unavailable. Refresh after the snapshot completes.', groups: [] };
  }
  connectionModalWidgetId = ''; widgetModalId = widget?.id || ''; drawDashboard();
}

async function addWidget(type: string): Promise<void> {
  if (!activeDashboard) return;
  const widget = await api<Widget>(`/dashboards/${activeDashboard.id}/widgets`, { method: 'POST', body: JSON.stringify({ type }) });
  store.add(widget); widgetPanelOpen = false; drawDashboard();
}

async function loadModalConnections(): Promise<void> {
  const widget = store.get(widgetModalId); if (!widget || !['calendar', 'email', 'tasks'].includes(widget.type)) return;
  const provider = widget.type === 'calendar' ? 'google-calendar' : widget.type === 'email' ? 'gmail' : 'todoist';
  await api(`/connections?type=${provider}`).catch(() => null);
}

function shouldReconnect(widget: Widget): boolean {
  return ['calendar', 'email'].includes(widget.type) && /oauth|token refresh|google/i.test(widget.errorMessage || '');
}

async function reconnectGoogle(): Promise<void> {
  const widget = store.get(widgetModalId); if (!widget) return;
  sessionStorage.setItem(OAUTH_CONTEXT_KEY, JSON.stringify({ dashboardId: widget.dashboardId, widgetId: widget.id, widgetType: widget.type }));
  const response = await api<{ authorizationUrl: string }>('/connections/gmail/oauth/start', { method: 'POST', body: JSON.stringify({ returnTo: window.location.href, connectionId: widget.config.connectionId || '' }) });
  window.location.href = response.authorizationUrl;
}

async function restoreOAuthResult(): Promise<void> {
  const params = hashParams(); const connectionId = params.get('oauthConnectionId'); const provider = params.get('oauthProvider');
  if (!connectionId || !provider || !activeDashboard) return;
  const rawContext = sessionStorage.getItem(OAUTH_CONTEXT_KEY); const context = rawContext ? JSON.parse(rawContext) as { dashboardId: string; widgetId: string; widgetType: string } : null;
  const widget = context ? store.get(context.widgetId) : undefined;
  if (widget && context?.dashboardId === activeDashboard.id) {
    const response = await api<{ items: Connection[] }>(`/connections?type=${encodeURIComponent(provider)}`);
    const connection = response.items.find((item) => item.id === connectionId);
    if (connection) {
      widget.config.connectionId = connection.id; widget.config.connectionName = connection.name; widget.config.provider = connection.type;
      widget.data = { provider: connection.type, connectionLabel: connection.name, dateLabel: 'Today', emptyMessage: 'Calendar events are still loading or unavailable. Refresh after the snapshot completes.', appointments: [] };
      editing = true;
    }
  }
  sessionStorage.removeItem(OAUTH_CONTEXT_KEY); params.delete('oauthConnectionId'); params.delete('oauthProvider');
  history.replaceState({}, '', `${location.pathname}${location.search}#/dashboard${params.size ? `?${params}` : ''}`);
}

function bindDragAndResize(): void {
  document.querySelectorAll<HTMLElement>('.widget-card').forEach(function (card) {
    let startX = 0; let startY = 0; let original: Widget | undefined;
    card.addEventListener('pointerdown', function (event) {
      if ((event.target as HTMLElement).closest('button,.widget-resize-handle')) return;
      original = store.get(card.dataset.widgetId || ''); startX = event.clientX; startY = event.clientY; card.setPointerCapture(event.pointerId);
    });
    card.addEventListener('pointermove', function (event) {
      if (!original || !card.hasPointerCapture(event.pointerId)) return;
      original.x += event.clientX - startX; original.y += event.clientY - startY; startX = event.clientX; startY = event.clientY;
      card.style.transform = `translate(${original.x}px, ${original.y}px)`;
    });
    card.addEventListener('pointerup', function () { original = undefined; });
    card.querySelector<HTMLElement>('.widget-resize-handle')?.addEventListener('pointerdown', function (event) {
      event.stopPropagation(); const widget = store.get(card.dataset.widgetId || ''); if (!widget) return;
      const x = event.clientX; const y = event.clientY; const width = widget.width; const height = widget.height; card.setPointerCapture(event.pointerId);
      const move = (next: PointerEvent) => { widget.width = Math.max(widget.minWidth || 140, width + next.clientX - x); widget.height = Math.max(widget.minHeight || 140, height + next.clientY - y); card.style.width = `${widget.width}px`; card.style.height = `${widget.height}px`; };
      card.addEventListener('pointermove', move); card.addEventListener('pointerup', function cleanup() { card.removeEventListener('pointermove', move); }, { once: true });
    });
  });
}

async function renderLogs(range = '30m', levels = ['info', 'warn', 'error']): Promise<void> {
  const result = await api<{ entries: Array<{ id: string; level: string; message: string; context: unknown }>; totals: { filtered: Record<string, number> } }>(`/admin/logs?range=${range}&levels=${levels.join(',')}&limit=200`);
  renderShell(`<section><h1>Logs</h1><p>Matching logs: ${result.entries.length}</p><label for="log-range">Time range</label><select id="log-range"><option value="30m" ${range === '30m' ? 'selected' : ''}>Last 30 minutes</option><option value="all" ${range === 'all' ? 'selected' : ''}>All available logs</option></select>
    <div><button id="toggle-info">Info (${result.totals.filtered.info || 0})</button></div><div id="log-list">${result.entries.map((entry) => `<article><p>${escapeHtml(entry.message)}</p><button class="show-context">Show context</button><pre hidden>${escapeHtml(JSON.stringify(entry.context, null, 2))}</pre></article>`).join('')}</div></section>`);
  requiredElement<HTMLSelectElement>('#log-range').addEventListener('change', function (event) { void renderLogs((event.target as HTMLSelectElement).value, levels); });
  requiredElement('#toggle-info').addEventListener('click', function () { void renderLogs(range, levels.filter((level) => level !== 'info')); });
  document.querySelectorAll('.show-context').forEach((button) => button.addEventListener('click', function () { const pre = button.nextElementSibling as HTMLElement; pre.hidden = false; }));
}

async function renderFeatureRoute(renderer: (context: RouteContext) => Promise<void>): Promise<void> {
  renderShell('<section id="route-content" aria-live="polite"><p>Loading…</p></section>');
  await renderer({
    api: (path, init) => api(path, init),
    container: requiredElement('#route-content'),
    notify,
    navigate: (target) => { window.location.hash = target.startsWith('#') ? target : `#${target}`; }
  });
}

function notify(message: string, kind: 'success' | 'error' | 'info' = 'info'): void {
  const container = document.querySelector<HTMLElement>('#notifications');
  if (!container) return;
  const notification = document.createElement('div');
  notification.className = `app-notification app-notification-${kind}`;
  notification.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  notification.textContent = message;
  container.append(notification);
  window.setTimeout(() => notification.remove(), 5000);
}

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  return requestJson<T>(`${config.apiBaseUrl}${path}`, init, localStorage.getItem(TOKEN_KEY), rejectSession);
}

/** Clear only the rejected session, never a newer login from another tab. */
function rejectSession(rejectedToken: string | null): void {
  if (localStorage.getItem(TOKEN_KEY) !== rejectedToken) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.setItem(ERROR_KEY, 'Daily Briefing could not verify your session. Please sign in again. If this continues, the service authentication configuration needs attention.');
  session = null;
  window.clearTimeout(autoRefreshTimer);
  dashboards = [];
  activeDashboard = null;
  store.replace([]);
  history.replaceState({}, '', `${location.pathname}${location.search}#/signed-out`);
  renderPublic('/signed-out');
}

function captureIncomingToken(): void {
  const match = location.href.match(/[?&]token=([^&#]+)/); if (!match?.[1]) return;
  try {
    const token = decodeURIComponent(match[1].replace(/\+/g, '%20')); session = parseToken(token); localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(SESSION_KEY, JSON.stringify(session)); localStorage.removeItem(ERROR_KEY);
  } catch (error) {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SESSION_KEY); localStorage.setItem(ERROR_KEY, error instanceof Error ? error.message : 'The authentication response was invalid.'); session = null;
  }
  const url = new URL(location.href); const hash = url.hash.split('?')[0] ?? ''; url.searchParams.delete('token'); url.hash = hash; history.replaceState({}, '', url);
}

function restoreSession(): Session | null {
  const token = localStorage.getItem(TOKEN_KEY); if (!token) return null;
  try { const restored = parseToken(token); localStorage.setItem(SESSION_KEY, JSON.stringify(restored)); return restored; } catch { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SESSION_KEY); return null; }
}

function beginSignIn(returnPath: string): void {
  localStorage.setItem(RETURN_PATH_KEY, returnPath); location.assign(buildSignInUrl({ signInUrl: config.authServiceSignInUrl, applicationId: config.authServiceApplicationId, appBaseUrl: config.appBaseUrl }, location.origin));
}

function hashPath(): string { return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'; }
function hashParams(): URLSearchParams { return new URLSearchParams(location.hash.includes('?') ? location.hash.slice(location.hash.indexOf('?') + 1) : ''); }
function isPublic(path: string): boolean { return ['/', '/terms', '/privacy', '/contact', '/signed-out', '/auth/callback'].includes(path); }
function field(label: string, id: string, type = 'text'): string { return `<label for="${id}">${label}</label><input id="${id}" type="${type}" class="form-control" required>`; }
function inputValue(selector: string): string { return requiredElement<HTMLInputElement | HTMLTextAreaElement>(selector).value; }
function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
function requiredElement<T extends Element = HTMLElement>(selector: string): T { const element = document.querySelector<T>(selector); if (!element) throw new Error(`Missing element: ${selector}`); return element; }
function requiredWidgetCard(element: Element): HTMLElement { const card = element.closest<HTMLElement>('.widget-card'); if (!card) throw new Error('Widget card not found.'); return card; }
function escapeHtml(value: string): string { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; }
