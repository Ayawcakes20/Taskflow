import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createServer } from 'vite';

let server, dom, api, AuthProvider, useAuth, ToastProvider, ThemeProvider, BrowserRouter, createRoot, root, container;
let requestHandler, sessionHandler, authSnapshot;
let authenticated = true;
const user = { _id: '507f1f77bcf86cd799439011', firstName: 'Audit', lastName: 'Test', role: 'User', preferences: { theme: 'light', notifications: { assignments: true, updates: true, deadlines: true, mentions: true } } };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000/tasks', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'localStorage', 'MutationObserver']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  ({ createRoot } = await import('react-dom/client'));
  server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom', logLevel: 'error' });
  api = (await server.ssrLoadModule('/src/services/api.js')).default;
  ({ AuthProvider, useAuth } = await server.ssrLoadModule('/src/context/AuthContext.jsx'));
  ({ ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx'));
  ({ ThemeProvider } = await server.ssrLoadModule('/src/context/ThemeContext.jsx'));
  ({ BrowserRouter } = await import('react-router-dom'));
  api.defaults.adapter = async (config) => {
    if (config.url === '/auth/me' && !authenticated) throw sessionFailure(401);
    const response = config.url === '/auth/me' ? await (sessionHandler?.(config) ?? { user }) : await requestHandler(config);
    return { config, status: 200, statusText: 'OK', headers: {}, data: { success: true, data: response } };
  };
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  container?.remove();
  authenticated = true;
  sessionHandler = undefined;
  authSnapshot = undefined;
});
after(async () => { await server?.close(); dom?.window.close(); });

async function mount(path, modulePath) {
  window.history.replaceState({}, '', path);
  const Page = typeof modulePath === 'function' ? modulePath : (await server.ssrLoadModule(modulePath)).default;
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(BrowserRouter, {}, React.createElement(ToastProvider, {}, React.createElement(ThemeProvider, {}, React.createElement(AuthProvider, {}, React.createElement(Page))))));
    await sleep(25);
  });
}
async function click(element) {
  assert.ok(element, 'Expected control exists');
  await act(async () => { element.click(); await sleep(15); });
}
async function fill(element, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
    element.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await act(async () => { await sleep(320); });
}

test('public home renders for guests and protected routes redirect to login', async () => {
  authenticated = false;
  window.history.replaceState({}, '', '/');
  const App = (await server.ssrLoadModule('/src/App.jsx')).default;
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(React.createElement(App)); await sleep(100); });
  await act(async () => { await sleep(150); });
  assert.match(container.textContent, /Big ideas/);
  assert.ok(container.querySelector('a[href="/register"]'));
  await act(async () => { window.history.pushState({}, '', '/tasks'); window.dispatchEvent(new window.PopStateEvent('popstate')); await sleep(100); });
  await act(async () => { await sleep(100); });
  assert.equal(window.location.pathname, '/login');
  assert.ok(container.querySelector('input[autocomplete="current-password"]'));
});

test('signup validation catches usernames, byte limits and mismatched confirmation without API writes', async () => {
  let writes = 0;
  requestHandler = async () => { writes++; throw new Error('Unexpected API write'); };
  await mount('/register', '/src/pages/auth/RegisterPage.jsx');
  for (const [key, value] of Object.entries({ firstName: 'UI', lastName: 'Test', username: 'bad!', email: 'ui@example.com', password: 'password123', confirmPassword: 'password123' })) await fill(container.querySelector(`#${key}`), value);
  await click(container.querySelector('button[type="submit"]'));
  assert.match(container.querySelector('[role="alert"]').textContent, /username/);
  await fill(container.querySelector('#username'), 'uitest');
  await fill(container.querySelector('#password'), 'a1' + 'é'.repeat(36));
  await click(container.querySelector('button[type="submit"]'));
  assert.match(container.querySelector('[role="alert"]').textContent, /72 UTF-8 bytes/);
  await fill(container.querySelector('#password'), 'password123');
  await fill(container.querySelector('#confirmPassword'), 'different123');
  await click(container.querySelector('button[type="submit"]'));
  assert.match(container.querySelector('[role="alert"]').textContent, /do not match/);
  assert.equal(writes, 0);
});

test('task search resets later pages when the query changes', async () => {
  const requests = [];
  requestHandler = async (config) => {
    if (config.url === '/users/assignees') return { items: [] };
    requests.push({ ...config.params });
    return { items: [], categories: [], pagination: { page: config.params.page, limit: 10, total: config.params.q ? 1 : 30, totalPages: config.params.q ? 1 : 3 } };
  };
  await mount('/tasks', '/src/pages/tasks/TasksPage.jsx');
  await click(container.querySelector('[aria-label="Next page"]'));
  assert.equal(requests.at(-1).page, 2);
  await fill(container.querySelector('input[aria-label="Search tasks"]'), 'needle');
  const searched = requests.filter((params) => params.q === 'needle');
  assert.ok(searched.length);
  assert.ok(searched.every((params) => params.page === 1));
  assert.equal(new URL(window.location.href).searchParams.get('q'), 'needle');
});

test('a delayed task search cannot overwrite the latest search results', async () => {
  const delayed = [];
  const response = (title, params) => ({ items: title ? [{ _id: title, title, status: 'Pending', priority: 'Medium', assignedUsers: [] }] : [], categories: [], pagination: { page: params.page, limit: 10, total: title ? 1 : 0, totalPages: 1 } });
  requestHandler = (config) => {
    if (config.url === '/users/assignees') return { items: [] };
    if (config.params.q === 'older') return new Promise((resolve) => delayed.push(() => resolve(response('Outdated task', config.params))));
    return response(config.params.q === 'latest' ? 'Latest task' : '', config.params);
  };
  await mount('/tasks', '/src/pages/tasks/TasksPage.jsx');
  await fill(container.querySelector('input[aria-label="Search tasks"]'), 'older');
  assert.ok(delayed.length);
  await fill(container.querySelector('input[aria-label="Search tasks"]'), 'latest');
  assert.ok(container.textContent.includes('Latest task'));
  await act(async () => { delayed.forEach((resolve) => resolve()); await sleep(15); });
  assert.ok(container.textContent.includes('Latest task'));
  assert.equal(container.textContent.includes('Outdated task'), false);
});

test('Kanban loads every API page and preserves older tasks in the board', async () => {
  const requests = [];
  const tasks = Array.from({ length: 201 }, (_, index) => ({ _id: String(index), title: `Task ${index}`, status: 'Completed', priority: 'Medium', assignedUsers: [] }));
  requestHandler = async (config) => {
    if (config.url === '/users/assignees') return { items: [] };
    requests.push(config.params.page);
    const skip = (config.params.page - 1) * 100;
    return { items: tasks.slice(skip, skip + 100), pagination: { totalPages: 3 } };
  };
  await mount('/kanban', '/src/pages/kanban/KanbanPage.jsx');
  assert.deepEqual(requests, [1, 2, 3]);
  assert.equal(container.querySelectorAll('.kanban-card').length, 201);
  assert.ok(container.textContent.includes('Task 200'));
});

test('notification pagination reaches older items and filters reset to page one', async () => {
  const requests = [];
  const notifications = Array.from({ length: 51 }, (_, index) => ({ _id: String(index), title: `Notification ${index}`, message: 'Test message', isRead: false, type: 'updated', createdAt: '2026-10-10T00:00:00Z' }));
  requestHandler = async (config) => {
    requests.push({ ...config.params });
    const skip = (config.params.page - 1) * 50;
    return { items: notifications.slice(skip, skip + 50), unread: 51, pagination: { page: config.params.page, total: 51, totalPages: 2 } };
  };
  await mount('/notifications', '/src/pages/notifications/NotificationsPage.jsx');
  await click(container.querySelector('[aria-label="Next page"]'));
  assert.ok(container.textContent.includes('Notification 50'));
  assert.equal(requests.at(-1).page, 2);
  await click([...container.querySelectorAll('.notification-tab')].find((element) => element.textContent.startsWith('Unread')));
  assert.equal(requests.at(-1).page, 1);
  assert.equal(requests.at(-1).read, 'false');
});

test('marking the last unread notification on a later page clamps pagination', async () => {
  let marked = false;
  requestHandler = async (config) => {
    if (config.method === 'put') { marked = true; return {}; }
    const page = config.params.page;
    return { items: !marked && page === 2 ? [{ _id: 'last', title: 'Last unread', message: 'Test', type: 'updated', isRead: false }] : [], unread: marked ? 50 : 51, pagination: { page, total: marked ? 50 : 51, totalPages: marked ? 1 : 2 } };
  };
  await mount('/notifications', '/src/pages/notifications/NotificationsPage.jsx');
  await click([...container.querySelectorAll('.notification-tab')].find((element) => element.textContent.startsWith('Unread')));
  await click(container.querySelector('[aria-label="Next page"]'));
  await click(container.querySelector('.notification-link'));
  await act(async () => { await sleep(20); });
  assert.ok(marked);
  assert.match(container.querySelector('.page-count').textContent, /Page 1 of 1/);
});

test('settings block overlapping writes, send a single preference and restore failures', async () => {
  const requests = [];
  let resolveRequest, rejectRequest;
  requestHandler = (config) => {
    const values = JSON.parse(config.data);
    requests.push(values);
    return new Promise((resolve, reject) => { resolveRequest = () => resolve({ preferences: { ...user.preferences, notifications: { ...user.preferences.notifications, ...values.notifications } } }); rejectRequest = () => reject(new Error('Simulated failure')); });
  };
  await mount('/settings', '/src/pages/settings/SettingsPage.jsx');
  const assignment = container.querySelector('[aria-label="Task assignments"]');
  const updates = container.querySelector('[aria-label="Task updates"]');
  await act(async () => { assignment.click(); updates.click(); await sleep(15); });
  assert.equal(updates.disabled, true);
  await click(updates);
  assert.deepEqual(requests, [{ notifications: { assignments: false } }]);
  await act(async () => { resolveRequest(); await sleep(15); });
  assert.equal(assignment.checked, false);
  assert.equal(updates.disabled, false);
  await click(updates);
  assert.deepEqual(requests.at(-1), { notifications: { updates: false } });
  await act(async () => { rejectRequest(); await sleep(15); });
  assert.equal(updates.checked, true);
  assert.equal(assignment.checked, false);
  assert.equal(updates.disabled, false);
});

function sessionFailure(status, headers = {}) {
  return Object.assign(new Error('Simulated session verification failure'), status ? { response: { status, headers } } : {});
}

function AuthProbe() {
  authSnapshot = useAuth();
  return React.createElement('span', {}, authSnapshot.user ? 'Authenticated' : 'No verified session');
}

async function mountApp(path) {
  window.history.replaceState({}, '', path);
  const App = (await server.ssrLoadModule('/src/App.jsx')).default;
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(React.createElement(App)); await sleep(50); });
}

test('HTTP 429 preserves an authenticated user and respects a long Retry-After without looping', async () => {
  await mount('/tasks', AuthProbe);
  let requests = 0;
  sessionHandler = async () => { requests++; throw sessionFailure(429, { 'retry-after': '900' }); };
  await act(async () => { await authSnapshot.refreshUser(); });
  assert.equal(authSnapshot.user._id, user._id);
  assert.equal(authSnapshot.sessionError, true);
  assert.equal(authSnapshot.loading, false);
  assert.equal(requests, 1);
});

for (const status of [undefined, 429, 503]) {
  test(`${status || 'Network'} failures preserve valid authentication with at most three attempts`, async () => {
    await mount('/tasks', AuthProbe);
    let requests = 0;
    sessionHandler = async () => { requests++; throw sessionFailure(status); };
    await act(async () => { await authSnapshot.refreshUser(); });
    assert.equal(authSnapshot.user._id, user._id);
    assert.equal(authSnapshot.sessionError, true);
    assert.equal(authSnapshot.loading, false);
    assert.equal(requests, 3);
    await act(async () => { await sleep(800); });
    assert.equal(requests, 3);
  });
}

test('HTTP 401 clears invalid sessions immediately without retries', async () => {
  await mount('/tasks', AuthProbe);
  let requests = 0;
  sessionHandler = async () => { requests++; throw sessionFailure(401); };
  await act(async () => { await authSnapshot.refreshUser(); });
  assert.equal(authSnapshot.user, null);
  assert.equal(authSnapshot.sessionError, false);
  assert.equal(requests, 1);
});

test('startup session checks recover automatically after a brief HTTP 429', async () => {
  let requests = 0;
  sessionHandler = async () => {
    requests++;
    if (requests === 1) throw sessionFailure(429, { 'retry-after': '0' });
    return { user };
  };
  await mount('/tasks', AuthProbe);
  await act(async () => { await sleep(50); });
  assert.equal(authSnapshot.user._id, user._id);
  assert.equal(authSnapshot.sessionError, false);
  assert.equal(requests, 2);
});

test('protected routes retain their URL during startup verification errors and recover on manual retry', async () => {
  let requests = 0;
  sessionHandler = async () => { requests++; throw sessionFailure(429, { 'retry-after': '900' }); };
  requestHandler = async () => ({ items: [], unread: 0, categories: [], pagination: { page: 1, total: 0, totalPages: 1 } });
  await mountApp('/tasks');
  await act(async () => { await sleep(100); });
  assert.equal(window.location.pathname, '/tasks');
  assert.match(container.querySelector('[role="alert"]').textContent, /Unable to verify your session/);
  assert.equal(requests, 1);
  sessionHandler = async () => ({ user });
  await click([...container.querySelectorAll('button')].find((button) => button.textContent === 'Retry session check'));
  await act(async () => { await sleep(200); });
  assert.equal(window.location.pathname, '/tasks');
  assert.ok(container.querySelector('.app-frame'));
  assert.equal(container.querySelector('[role="alert"]'), null);
});

test('logout cancels delayed verification so it cannot restore an old session', async () => {
  await mount('/tasks', AuthProbe);
  let resolveSession;
  sessionHandler = () => new Promise((resolve) => { resolveSession = resolve; });
  requestHandler = async () => ({});
  let pending;
  await act(async () => { pending = authSnapshot.refreshUser(); await sleep(10); });
  await act(async () => { await authSnapshot.logout(); resolveSession({ user }); await pending; });
  assert.equal(authSnapshot.user, null);
  assert.equal(authSnapshot.loading, false);
});

test('admin navigation highlights only the matching overview, people or activity link', async () => {
  sessionHandler = async () => ({ user: { ...user, role: 'Admin' } });
  requestHandler = async () => ({ items: [], unread: 0 });
  await mount('/admin', '/src/components/layout/AppShell.jsx');
  for (const path of ['/admin', '/admin/users', '/admin/activity']) {
    await act(async () => { window.history.pushState({}, '', path); window.dispatchEvent(new window.PopStateEvent('popstate')); await sleep(15); });
    const links = [...container.querySelectorAll('.desktop-sidebar a[href^="/admin"]')];
    assert.equal(links.length, 3);
    for (const link of links) {
      assert.equal(link.classList.contains('active'), link.getAttribute('href') === path, `${path}: ${link.getAttribute('href')}`);
      assert.equal(link.getAttribute('aria-current'), link.getAttribute('href') === path ? 'page' : null);
    }
  }
});
