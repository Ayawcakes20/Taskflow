// Local visual-review fixture only. No MongoDB, JWT secrets or real accounts.
// Run from frontend: node tests/ui-fixture-server.mjs
// This server never forwards requests to the production backend.
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { workspaceDayKey } from '../src/utils/workspaceDates.js';
import { randomBytes } from 'node:crypto';

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  throw new Error('The local UI fixture must not run in production.');
}

const express = createRequire(new URL('../../backend/package.json', import.meta.url))('express');

const app = express();
app.use(express.json());
const today = workspaceDayKey();
const now = new Date().toISOString();
const user = { _id: '507f1f77bcf86cd799439011', firstName: 'Alexandria', lastName: 'Santos', username: 'alex.fixture', email: 'alex@example.invalid', role: 'Admin', isActive: true, createdAt: now, profileImage: '', preferences: { theme: 'light', notifications: { assignments: true, updates: true, deadlines: true, mentions: true } } };
const people = [user, { ...user, _id: '507f1f77bcf86cd799439012', firstName: 'Miguel', lastName: 'Garcia', username: 'miguel.fixture', email: 'miguel@example.invalid', role: 'User' }];
let authenticated = true;
let errors = false;
const verificationFixture = () => ({ challengeId: randomBytes(32).toString('hex'), emailHint: 'f***@example.invalid', expiresAt: new Date(Date.now() + 300000).toISOString(), resendAt: new Date(Date.now() + 60000).toISOString() });
const tasks = Array.from({ length: 12 }, (_, index) => ({
  _id: (index + 1).toString(16).padStart(24, '0'),
  title: index === 0 ? 'Review presentation requirements and prepare the final project demonstration' : index === 1 ? 'LongUnbrokenTaskTitleForResponsiveLayoutVerification'.repeat(3) : ['Design the onboarding flow', 'Verify task assignments', 'Prepare module screenshots', 'Review project documentation'][index % 4],
  description: 'Discuss the next step with your teammates, verify the requirements, and keep the project details up to date.',
  status: ['Pending', 'In Progress', 'Completed'][index % 3], priority: ['High', 'Medium', 'Low'][index % 3], category: index === 1 ? 'VeryLongUnbrokenCategoryLabelForLayoutChecks' : 'Presentation',
  assignedUsers: people, createdBy: user, dueDate: `${today}T00:00:00.000Z`, createdAt: now, updatedAt: now,
  subtasks: [{ _id: 'subtask-fixture', title: 'Check layout and keyboard navigation', completed: false }],
  comments: [{ _id: 'comment-fixture', user: people[1], content: 'Please review the final presentation checklist, @alex.fixture.', createdAt: now, updatedAt: now }],
}));
const activity = [{ _id: 'activity-fixture', actor: people[1], action: 'task.updated', entityTitle: tasks[0].title, createdAt: now, details: 'Updated the presentation checklist.' }];
const notifications = tasks.slice(0, 4).map((task, index) => ({ _id: `notification-${index}`, task, title: ['Deadline approaching', 'Task assigned', 'Task status updated', 'You were mentioned'][index], message: index === 1 ? 'Miguel assigned you a task. Review the details when you are ready.' : 'An update is available for your presentation project.', type: ['approaching_deadline', 'assigned', 'updated', 'mention'][index], isRead: index === 0, createdAt: now }));
const paginate = (items, query) => {
  const limit = Number(query.limit) || 10;
  const page = Number(query.page) || 1;
  return { items: items.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / limit)) } };
};

app.get('/__fixture', (_req, res) => res.send('<h1>Taskflow local UI fixture</h1><p>Invented in-memory data; no production connection.</p><a href="/__fixture/admin">Admin workspace</a> · <a href="/__fixture/user">User workspace</a> · <a href="/__fixture/guest">Public pages</a> · <a href="/__fixture/errors">Failure states</a>'));
app.get('/__fixture/:mode', (req, res) => {
  if (req.params.mode === 'verification') {
    authenticated = false; errors = false;
    return res.send(`<script>sessionStorage.setItem('taskflow:registration-challenge', ${JSON.stringify(JSON.stringify(verificationFixture()))}); location.replace('/register/verify');</script>`);
  }
  authenticated = req.params.mode !== 'guest'; errors = req.params.mode === 'errors'; user.role = req.params.mode === 'user' ? 'User' : 'Admin';
  res.redirect(authenticated ? '/dashboard' : '/');
});
app.use('/api', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const success = (data = {}) => res.json({ success: true, data });
  if (req.path === '/auth/me') return authenticated ? success({ user }) : res.status(401).json({ success: false, message: 'Please sign in to continue.' });
  if (['/auth/register/verify', '/auth/register/resend', '/auth/forgot-password', '/auth/forgot-password/resend', '/auth/forgot-password/verify', '/auth/reset-password'].includes(req.path)) return res.status(503).json({ success: false, message: 'Email-code verification and password recovery are temporarily unavailable.' });
  if (req.path === '/auth/login' || req.path === '/auth/register') { authenticated = true; return success({ user }); }
  if (req.path === '/auth/logout') { authenticated = false; return success(); }
  if (!authenticated) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
  if (errors) return res.status(503).json({ success: false, message: 'Local fixture: data is temporarily unavailable.' });
  if (req.path === '/dashboard') return success({ stats: { total: 12, pending: 4, inProgress: 4, completed: 4, overdue: 0 }, breakdown: { status: ['Pending', 'In Progress', 'Completed'].map((_id) => ({ _id, count: 4 })), priority: ['High', 'Medium', 'Low'].map((_id) => ({ _id, count: 4 })) }, upcomingDeadlines: tasks.slice(0, 3), recentTasks: tasks.slice(0, 5), recentActivity: activity, completionTrend: Array.from({ length: 7 }, (_, index) => ({ date: new Date(Date.now() - (6 - index) * 86400000).toISOString().slice(0, 10), label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][index], count: index % 3 })) });
  if (req.path === '/reports') return success({ summary: { total: 12, completed: 4, completionRate: 33, overdue: 0 }, byStatus: ['Pending', 'In Progress', 'Completed'].map((_id) => ({ _id, count: 4 })), byPriority: ['High', 'Medium', 'Low'].map((_id) => ({ _id, count: 4 })), byCategory: [{ _id: 'Presentation', count: 10 }, { _id: tasks[1].category, count: 2 }], trend: Array.from({ length: 30 }, (_, index) => ({ date: new Date(Date.now() - (29 - index) * 86400000).toISOString().slice(0, 10), count: index % 3 === 0 ? 2 : 0 })) });
  if (req.path === '/activity') return success(paginate(activity, req.query));
  if (req.path === '/users/assignees') return success({ items: people });
  if (req.path === '/users') return success(paginate(people.filter((person) => !req.query.q || person.firstName.toLowerCase().includes(req.query.q.toLowerCase())), req.query));
  if (req.path === '/users/me/preferences') { user.preferences = { ...user.preferences, ...req.body, notifications: { ...user.preferences.notifications, ...req.body.notifications } }; return success({ preferences: user.preferences }); }
  if (req.path.startsWith('/users/')) { if (req.method === 'PUT') Object.assign(user, req.body); return success({ user, summary: { createdTasks: 6, assignedTasks: 12 } }); }
  if (req.path === '/notifications/read-all') { notifications.forEach((item) => { item.isRead = true; }); return success(); }
  if (req.path.startsWith('/notifications/') && req.method === 'PUT') { const item = notifications.find((item) => req.path.includes(item._id)); if (item) item.isRead = true; return success(); }
  if (req.path === '/notifications') return success({ ...paginate(notifications.filter((item) => req.query.read === undefined || String(item.isRead) === req.query.read), req.query), unread: notifications.filter((item) => !item.isRead).length });
  if (req.path === '/tasks') return success({ ...paginate(tasks.filter((task) => (!req.query.q || task.title.toLowerCase().includes(req.query.q.toLowerCase())) && (!req.query.status || task.status === req.query.status)), req.query), categories: ['Presentation', tasks[1].category] });
  if (req.path.startsWith('/tasks/')) {
    const task = tasks.find((task) => req.path === `/tasks/${task._id}`);
    if (!task) return res.status(404).json({ success: false, message: 'Fixture task not found.' });
    if (req.method === 'PUT') Object.assign(task, req.body);
    return success({ task, activity });
  }
  return res.status(400).json({ success: false, message: 'This operation is outside the local visual fixture.' });
});

const vite = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
app.use(vite.middlewares);
const server = app.listen(4311, '127.0.0.1', () => console.info('Local UI fixture: http://127.0.0.1:4311/__fixture (no database connection)'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await vite.close(); process.exit(0); }));
