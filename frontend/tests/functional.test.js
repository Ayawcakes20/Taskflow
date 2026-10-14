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
  for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'localStorage', 'sessionStorage', 'MutationObserver']) globalThis[key] = dom.window[key];
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
  sessionStorage.clear();
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
    const prototype = element instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
    element.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await act(async () => { await sleep(320); });
}

async function mountRoute(path, modulePath, pattern) {
  const Page = (await server.ssrLoadModule(modulePath)).default;
  const { Routes, Route } = await import('react-router-dom');
  await mount(path, () => React.createElement(Routes, {}, React.createElement(Route, { path: pattern, element: React.createElement(Page) })));
}

test('failed task edits block the empty form and recover through retry without writes', async () => {
  let attempts = 0;
  let writes = 0;
  requestHandler = async (config) => {
    if (config.method !== 'get') { writes++; throw new Error('Unexpected write'); }
    if (config.url === '/users/assignees') return { items: [] };
    if (++attempts === 1) throw new Error('Task could not be loaded');
    return { task: { _id: 'fixture', title: 'Loaded task', status: 'Pending', priority: 'Medium' } };
  };
  await mountRoute('/tasks/fixture/edit', '/src/pages/tasks/TaskEditorPage.jsx', '/tasks/:id/edit');
  assert.ok(container.querySelector('.load-error'));
  assert.equal(container.querySelector('form'), null);
  await click([...container.querySelectorAll('button')].find((button) => button.textContent === 'Try again'));
  assert.equal(container.querySelector('#task-title').value, 'Loaded task');
  assert.equal(writes, 0);
});

test('profile load failures block blank editing and retry restores the profile', async () => {
  let attempts = 0;
  requestHandler = async () => {
    if (++attempts === 1) throw new Error('Profile could not be loaded');
    return { user: { ...user, username: 'fixture', email: 'fixture@example.com' }, summary: {} };
  };
  const Profile = (await server.ssrLoadModule('/src/pages/profile/ProfilePage.jsx')).default;
  await mount('/profile', () => useAuth().user ? React.createElement(Profile) : null);
  assert.equal(container.querySelector('form'), null);
  assert.equal(container.querySelectorAll('[role="alert"]').length, 1);
  await click([...container.querySelectorAll('button')].find((button) => button.textContent === 'Try again'));
  assert.equal(container.querySelector('#firstName').value, user.firstName);
});

test('loading buttons stay disabled even when the caller passes disabled false', async () => {
  const { Button } = await server.ssrLoadModule('/src/components/common/Primitives.jsx');
  await mount('/fixture', () => React.createElement(Button, { loading: true, disabled: false }, 'Save'));
  assert.equal(container.querySelector('button').disabled, true);
  assert.equal(container.querySelector('button').getAttribute('aria-busy'), 'true');
});

test('task cancellation asks before discarding edits and keep editing preserves the draft', async () => {
  requestHandler = async () => ({ items: [] });
  await mount('/tasks/create', '/src/pages/tasks/TaskEditorPage.jsx');
  await fill(container.querySelector('#task-title'), 'Unsaved draft');
  const reload = new window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(reload);
  assert.equal(reload.defaultPrevented, true);
  await click(container.querySelector('a[href="/tasks"]'));
  assert.equal(window.location.pathname, '/tasks/create');
  assert.match(container.querySelector('[role="alertdialog"]').textContent, /Leave without saving/);
  await click([...container.querySelectorAll('button')].find((button) => button.textContent === 'Keep editing'));
  assert.equal(container.querySelector('#task-title').value, 'Unsaved draft');
});

test('workspace search asks before leaving an unsaved task editor', async () => {
  requestHandler = async () => ({ items: [], unread: 0 });
  await mountApp('/tasks/create');
  await act(async () => { await sleep(150); });
  await fill(container.querySelector('#task-title'), 'Draft to preserve');
  await act(async () => { container.querySelector('.top-search').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(15); });
  assert.equal(window.location.pathname, '/tasks/create');
  assert.ok(container.querySelector('[role="alertdialog"]'));
});

test('sign out protects a draft and only calls logout after confirmation', async () => {
  let logouts = 0;
  requestHandler = async (config) => {
    if (config.url === '/auth/logout') { logouts++; return {}; }
    return { items: [], unread: 0 };
  };
  await mountApp('/tasks/create');
  await act(async () => { await sleep(150); });
  await fill(container.querySelector('#task-title'), 'Draft to preserve');
  await click(container.querySelector('.logout-link'));
  assert.equal(logouts, 0);
  assert.equal(window.location.pathname, '/tasks/create');
  await click([...container.querySelectorAll('button')].find((button) => button.textContent === 'Keep editing'));
  assert.equal(container.querySelector('#task-title').value, 'Draft to preserve');
  assert.equal(logouts, 0);
  await click(container.querySelector('.logout-link'));
  await click([...container.querySelector('[role="alertdialog"]').querySelectorAll('button')].find((button) => button.textContent === 'Sign out'));
  await act(async () => { await sleep(150); });
  assert.equal(logouts, 1);
  assert.equal(window.location.pathname, '/login');
});

test('sign out without unsaved changes keeps the existing logout workflow', async () => {
  let logouts = 0;
  requestHandler = async (config) => {
    if (config.url === '/auth/logout') { logouts++; return {}; }
    return { items: [], unread: 0 };
  };
  await mountApp('/tasks/create');
  await act(async () => { await sleep(150); });
  await click(container.querySelector('.logout-link'));
  await act(async () => { await sleep(150); });
  assert.equal(logouts, 1);
  assert.equal(container.querySelector('[role="alertdialog"]'), null);
  assert.equal(window.location.pathname, '/login');
});

for (const [modulePath, path, searchLabel] of [
  ['/src/pages/users/AdminUsersPage.jsx', '/admin/users', 'Search users'],
  ['/src/pages/users/AdminActivityPage.jsx', '/admin/activity', 'Search activity'],
]) {
  test(`${searchLabel} keeps the latest results when an older response arrives last`, async () => {
    let resolveOld;
    const response = (name) => ({ items: [{ _id: name, firstName: name, lastName: 'Fixture', username: name, email: 'fixture@example.com', role: 'User', isActive: true, action: 'task.created', entityTitle: name, actor: user }], pagination: { total: 1, totalPages: 1 } });
    requestHandler = (config) => config.params.q === 'older' ? new Promise((resolve) => { resolveOld = () => resolve(response('Outdated fixture')); }) : response(config.params.q === 'latest' ? 'Latest fixture' : 'Initial fixture');
    await mount(path, modulePath);
    await fill(container.querySelector(`input[aria-label="${searchLabel}"]`), 'older');
    await fill(container.querySelector(`input[aria-label="${searchLabel}"]`), 'latest');
    assert.match(container.textContent, /Latest fixture/);
    await act(async () => { resolveOld(); await sleep(15); });
    assert.match(container.textContent, /Latest fixture/);
    assert.doesNotMatch(container.textContent, /Outdated fixture/);
  });
}

test('calendar ignores a delayed response from a previously viewed month', async () => {
  let resolveOld;
  let requests = 0;
  requestHandler = (config) => {
    const response = (count) => ({ items: Array.from({ length: count }, (_, index) => ({ _id: String(index), title: `Fixture ${index}`, dueDate: config.params.dueFrom, status: 'Pending', priority: 'Medium' })), pagination: { totalPages: 1 } });
    if (++requests === 1) return new Promise((resolve) => { resolveOld = () => resolve(response(1)); });
    return response(2);
  };
  await mount('/calendar', '/src/pages/calendar/CalendarPage.jsx');
  await click(container.querySelector('[aria-label="Next month"]'));
  assert.match(container.querySelector('.calendar-month-chip').textContent, /2 dated tasks/);
  await act(async () => { resolveOld(); await sleep(15); });
  assert.match(container.querySelector('.calendar-month-chip').textContent, /2 dated tasks/);
});

test('registration errors identify invalid fields, focus the first error and keep guidance plain', async () => {
  requestHandler = async () => { throw new Error('Unexpected write'); };
  await mount('/register', '/src/pages/auth/RegisterPage.jsx');
  await click(container.querySelector('button[type="submit"]'));
  assert.equal(document.activeElement.id, 'firstName');
  assert.equal(container.querySelectorAll('input[aria-invalid="true"]').length, 6);
  for (const input of container.querySelectorAll('input[aria-invalid="true"]')) assert.ok(document.getElementById(input.getAttribute('aria-describedby')));
  assert.doesNotMatch(container.textContent, /UTF-8 bytes/);
});

test('password settings reject oversized unicode before sending an API write', async () => {
  let writes = 0;
  requestHandler = async () => { writes++; return {}; };
  await mount('/settings', '/src/pages/settings/SettingsPage.jsx');
  await fill(container.querySelector('#currentPassword'), 'fixture123');
  await fill(container.querySelector('#newPassword'), 'a1' + 'é'.repeat(36));
  await fill(container.querySelector('#confirmPassword'), 'a1' + 'é'.repeat(36));
  await click(container.querySelector('button[type="submit"]'));
  assert.match(container.querySelector('[role="alert"]').textContent, /too long/);
  assert.equal(writes, 0);
});

test('theme radios use a single tab stop and arrow keys select the next theme', async () => {
  requestHandler = async (config) => ({ preferences: { ...user.preferences, ...config.data && JSON.parse(config.data) } });
  await mount('/settings', '/src/pages/settings/SettingsPage.jsx');
  const radios = container.querySelectorAll('[role="radio"]');
  assert.equal([...radios].filter((radio) => radio.tabIndex === 0).length, 1);
  await act(async () => { radios[0].focus(); radios[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await sleep(20); });
  assert.equal(radios[1].getAttribute('aria-checked'), 'true');
  assert.equal(document.activeElement, radios[1]);
});

test('failed reports do not render fabricated zeros and retry restores real summaries', async () => {
  let attempts = 0;
  requestHandler = async () => {
    if (++attempts === 1) throw new Error('Reports unavailable');
    return { summary: { total: 4, completed: 2, completionRate: 50 }, trend: [] };
  };
  await mount('/reports', '/src/pages/reports/ReportsPage.jsx');
  assert.equal(container.querySelector('.report-summary-grid'), null);
  await click([...container.querySelectorAll('button')].find((button) => button.textContent === 'Try again'));
  assert.match(container.querySelector('.report-summary-grid').textContent, /50%/);
});

test('report zero counts draw zero-height bars and day counts are keyboard-readable', async () => {
  requestHandler = async () => ({ summary: { total: 2 }, trend: [{ date: '2026-10-13', count: 0 }, { date: '2026-10-14', count: 2 }] });
  await mount('/reports', '/src/pages/reports/ReportsPage.jsx');
  const columns = container.querySelectorAll('.report-trend-column');
  assert.equal(columns[0].querySelector('.report-trend-bar').style.height, '0%');
  assert.equal(columns[1].querySelector('.report-trend-bar').style.height, '100%');
  assert.equal(columns[0].tabIndex, 0);
  assert.match(columns[0].getAttribute('aria-label'), /0 completed tasks/);
});

test('notification filters expose selection and the read empty state describes its filter', async () => {
  requestHandler = async (config) => ({ items: [], unread: 3, pagination: { total: config.params.read ? 0 : 3, totalPages: 1 } });
  await mount('/notifications', '/src/pages/notifications/NotificationsPage.jsx');
  await click([...container.querySelectorAll('.notification-tab')].find((button) => button.textContent === 'Read'));
  assert.match(container.textContent, /No read notifications/);
  assert.equal(container.querySelector('.notification-tab').querySelector('span'), null);
  assert.equal(container.querySelector('.notification-tab.active').getAttribute('aria-pressed'), 'true');
});

test('mobile navigation exposes a dialog and Escape closes it', async () => {
  requestHandler = async () => ({ items: [], unread: 0 });
  await mount('/tasks', '/src/components/layout/AppShell.jsx');
  const opener = container.querySelector('[aria-label="Open navigation"]');
  await click(opener);
  assert.equal(opener.getAttribute('aria-expanded'), 'true');
  assert.equal(container.querySelector('#mobile-navigation').getAttribute('aria-modal'), 'true');
  assert.ok(container.querySelector('.app-main').hasAttribute('inert'));
  await act(async () => { document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(200); });
  assert.equal(opener.getAttribute('aria-expanded'), 'false');
  assert.equal(container.querySelector('.app-main').hasAttribute('inert'), false);
});

test('notification dropdown reports loading failures instead of an empty inbox', async () => {
  requestHandler = async () => { throw new Error('Inbox unavailable'); };
  await mount('/tasks', '/src/components/layout/AppShell.jsx');
  await click(container.querySelector('.header-bell'));
  assert.match(container.querySelector('.notification-dropdown').textContent, /Unable to reach Taskflow/);
  assert.doesNotMatch(container.querySelector('.notification-dropdown').textContent, /No notifications yet|All caught up/);
});

test('unknown routes show a useful not-found page without changing the address', async () => {
  requestHandler = async () => ({});
  await mountApp('/missing-fixture');
  await act(async () => { await sleep(100); });
  assert.match(container.textContent, /Page not found/);
  assert.equal(window.location.pathname, '/missing-fixture');
});

test('task table exposes column relationships, current-page selection and explicit deletion', async () => {
  requestHandler = async () => ({ items: [] });
  const Table = (await server.ssrLoadModule('/src/components/tasks/TaskTable.jsx')).default;
  await mount('/tasks', () => React.createElement(Table, { tasks: [{ _id: 'fixture', title: 'Accessible task', status: 'Pending', priority: 'High' }], onToggle() {}, onDelete() {} }));
  assert.equal(container.querySelector('[role="table"]').getAttribute('aria-label'), 'Tasks');
  assert.equal(container.querySelectorAll('[role="columnheader"]').length, 7);
  assert.equal(container.querySelectorAll('.task-row [role="cell"]').length, 7);
  assert.ok(container.querySelector('[aria-label="Select all tasks on this page"]'));
  assert.ok(container.querySelector('[aria-label="Delete Accessible task"]'));
});

test('mention suggestions match task visibility and restore focus to the composer', async () => {
  const people = [
    { ...user, username: 'participant' },
    { ...user, _id: 'other', role: 'Admin', username: 'administrator' },
    { ...user, _id: 'unrelated', username: 'outsider' },
  ];
  requestHandler = async () => ({ items: people });
  const Comments = (await server.ssrLoadModule('/src/components/tasks/TaskCommentsPanel.jsx')).default;
  await mount('/tasks/fixture', () => React.createElement(Comments, { task: { _id: 'fixture', createdBy: user, comments: [] }, onTaskChange() {} }));
  await fill(container.querySelector('textarea'), '@');
  const suggestions = container.querySelector('[aria-label="Mention suggestions"]');
  assert.equal(suggestions.getAttribute('role'), 'group');
  assert.match(suggestions.textContent, /people with access/);
  assert.match(suggestions.textContent, /participant|administrator/);
  assert.doesNotMatch(suggestions.textContent, /outsider/);
  await click(suggestions.querySelector('button'));
  assert.equal(container.querySelector('textarea').value, '@everyone ');
  assert.equal(document.activeElement, container.querySelector('textarea'));
});

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
  assert.match(container.querySelector('[role="alert"]').textContent, /too long/);
  assert.doesNotMatch(container.textContent, /UTF-8 bytes/);
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

test('registration issuance does not authenticate and verification alone establishes the existing session', async () => {
  authenticated = false;
  await mount('/register', AuthProbe);
  const challenge = { challengeId: 'a'.repeat(64), emailHint: 'f***@example.invalid', expiresAt: new Date(Date.now() + 300000).toISOString(), resendAt: new Date(Date.now() + 60000).toISOString() };
  const paths = [];
  requestHandler = async (config) => { paths.push(config.url); return config.url === '/auth/register' ? challenge : { user }; };
  let result;
  await act(async () => { result = await authSnapshot.register({}); });
  assert.equal(result.challengeId, challenge.challengeId); assert.equal(authSnapshot.user, null);
  await act(async () => { await authSnapshot.verifyRegistration({ challengeId: challenge.challengeId, code: '123456' }); });
  assert.equal(authSnapshot.user._id, user._id);
  assert.deepEqual(paths, ['/auth/register', '/auth/register/verify']);
});

test('OTP entry accepts pasted digits, exposes expiry and blocks resend during cooldown', async () => {
  const { CodeForm } = await server.ssrLoadModule('/src/components/common/EmailVerification.jsx');
  const challenge = { challengeId: 'a'.repeat(64), emailHint: 'f***@example.invalid', expiresAt: new Date(Date.now() + 300000).toISOString(), resendAt: new Date(Date.now() + 60000).toISOString() };
  let verified = false;
  await mount('/fixture', () => React.createElement(CodeForm, { challenge, onVerify: (value) => { verified = /^\d{6}$/.test(value); }, onResend() {} }));
  const input = container.querySelector('#verification-code');
  assert.equal(input.getAttribute('autocomplete'), 'one-time-code'); assert.equal(input.getAttribute('inputmode'), 'numeric');
  assert.equal([...container.querySelectorAll('button')].find((button) => button.textContent.includes('Resend in')).disabled, true);
  await fill(input, '123 456'); await click(container.querySelector('button[type="submit"]'));
  assert.equal(verified, true); assert.ok(container.textContent.includes('f***@example.invalid'));
});

test('expired verification disables submission but allows requesting a new code', async () => {
  const { CodeForm } = await server.ssrLoadModule('/src/components/common/EmailVerification.jsx');
  const challenge = { challengeId: 'a'.repeat(64), emailHint: 'f***@example.invalid', expiresAt: new Date(Date.now() - 1000).toISOString(), resendAt: new Date(Date.now() - 1000).toISOString() };
  await mount('/fixture', () => React.createElement(CodeForm, { challenge, onVerify() {}, onResend() {} }));
  assert.equal(container.querySelector('button[type="submit"]').disabled, true);
  assert.match(container.textContent, /has expired/);
  assert.equal([...container.querySelectorAll('button')].find((button) => button.textContent === 'Resend code').disabled, false);
});

test('forgot password progresses through verification and confirmation without logging in or persisting grants', async () => {
  authenticated = false;
  const paths = [];
  const challenge = { challengeId: 'a'.repeat(64), emailHint: 'f***@example.invalid', expiresAt: new Date(Date.now() + 300000).toISOString(), resendAt: new Date(Date.now() + 60000).toISOString() };
  requestHandler = async (config) => {
    paths.push(config.url);
    if (config.url === '/auth/forgot-password') return challenge;
    if (config.url === '/auth/forgot-password/verify') return { resetToken: 'b'.repeat(64), expiresAt: new Date(Date.now() + 300000).toISOString() };
    return {};
  };
  await mount('/forgot-password', '/src/pages/auth/ForgotPasswordPage.jsx');
  await fill(container.querySelector('#recovery-email'), 'fixture@example.invalid'); await click(container.querySelector('button[type="submit"]'));
  assert.match(container.textContent, /eligible account/); assert.equal(container.querySelector('#recovery-email'), null);
  await fill(container.querySelector('#verification-code'), '123456'); await click(container.querySelector('button[type="submit"]'));
  assert.equal(sessionStorage.getItem('taskflow:recovery-challenge'), null);
  await fill(container.querySelector('#reset-newPassword'), 'FixturePassword123!'); await fill(container.querySelector('#reset-confirmPassword'), 'DifferentPassword123!');
  await click(container.querySelector('button[type="submit"]'));
  assert.match(container.querySelector('[role="alert"]').textContent, /do not match/); assert.equal(paths.includes('/auth/reset-password'), false);
  await fill(container.querySelector('#reset-confirmPassword'), 'FixturePassword123!'); await click(container.querySelector('button[type="submit"]'));
  assert.ok(container.querySelector('a[href="/login"]')); assert.match(container.textContent, /Previous sessions/);
  assert.deepEqual(paths, ['/auth/forgot-password', '/auth/forgot-password/verify', '/auth/reset-password']);
  assert.equal(window.location.pathname, '/login');
});

test('forgot password retries delivery errors without displaying a false success', async () => {
  requestHandler = async () => { throw Object.assign(new Error('Unavailable'), { response: { status: 503, data: { message: 'Email delivery unavailable.' } } }); };
  await mount('/forgot-password', '/src/pages/auth/ForgotPasswordPage.jsx');
  await fill(container.querySelector('#recovery-email'), 'fixture@example.invalid'); await click(container.querySelector('button[type="submit"]'));
  assert.match(container.querySelector('[role="alert"]').textContent, /unavailable/); assert.ok(container.querySelector('#recovery-email'));
  assert.equal(container.querySelector('#verification-code'), null);
});

test('registration verification reloads only metadata and handles absent challenges safely', async () => {
  const challenge = { challengeId: 'a'.repeat(64), emailHint: 'f***@example.invalid', expiresAt: new Date(Date.now() + 300000).toISOString(), resendAt: new Date(Date.now() + 60000).toISOString() };
  sessionStorage.setItem('taskflow:registration-challenge', JSON.stringify(challenge));
  await mount('/register/verify', '/src/pages/auth/VerifyRegistrationPage.jsx');
  assert.ok(container.querySelector('#verification-code'));
  assert.equal(Object.keys(JSON.parse(sessionStorage.getItem('taskflow:registration-challenge'))).length, 4);
});

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
