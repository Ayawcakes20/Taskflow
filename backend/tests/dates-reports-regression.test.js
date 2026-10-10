import test from 'node:test';
import assert from 'node:assert/strict';
import { taskSchema, taskUpdateSchema } from '../utils/validation.js';
import { deadlineBoundary, completionWindow, workspaceDayKey } from '../../frontend/src/utils/workspaceDates.js';
import { isDueDateOverdue, relativeDate } from '../../frontend/src/utils/format.js';
import { isUpcomingDeadline, hasValidDueDate } from '../../frontend/src/utils/taskDates.js';
import { applyDashboardTaskUpdate } from '../../frontend/src/utils/dashboardState.js';
import { buildCompletionTrend } from '../utils/dashboardState.js';
import { getReports } from '../controllers/reportController.js';
import { listTasks } from '../controllers/taskController.js';
import { syncDeadlineNotifications } from '../utils/notifications.js';
import Task from '../models/Task.js';

test('task dates reject impossible days and preserve leap days, timestamps and clearing', () => {
  for (const date of ['2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00']) {
    assert.equal(taskSchema.safeParse({ title: 'Date test', dueDate: date }).success, false, date);
    assert.equal(taskUpdateSchema.safeParse({ dueDate: date }).success, false, date);
    assert.equal(hasValidDueDate({ dueDate: date }), false, date);
  }
  for (const date of ['2024-02-29', '2026-02-28', '2026-10-10T00:00:00+08:00', '', null]) {
    assert.equal(taskSchema.safeParse({ title: 'Date test', dueDate: date }).success, true);
  }
});

test('deadline UI, optimistic counts and server boundaries agree at Manila midnight', () => {
  const before = new Date('2026-10-09T15:59:59Z');
  const after = new Date('2026-10-09T16:00:00Z');
  const task = { _id: 'task', dueDate: '2026-10-09T00:00:00Z', status: 'Pending' };
  assert.equal(workspaceDayKey(before), '2026-10-09');
  assert.equal(workspaceDayKey(after), '2026-10-10');
  for (const [now, overdue] of [[before, false], [after, true]]) {
    assert.equal(isDueDateOverdue(task.dueDate, now), overdue);
    assert.equal(new Date(task.dueDate) < deadlineBoundary(now), overdue);
    assert.equal(isUpcomingDeadline(task, now), !overdue);
  }
  assert.equal(relativeDate('2026-10-10', after), 'Today');
  assert.equal(relativeDate('2026-10-11', after), 'Tomorrow');
  const dashboard = { stats: { overdue: 1, pending: 1, completed: 0 } };
  assert.equal(applyDashboardTaskUpdate(dashboard, task, { ...task, status: 'Completed' }, after).stats.overdue, 0);
});

test('reports count current completed tasks once, including creation, recompletion and legacy tasks', () => {
  const now = new Date('2026-10-09T16:30:00Z');
  const tasks = [
    { status: 'Completed', completedAt: '2026-10-09T16:01:00Z' }, // Created complete.
    { status: 'Completed', completedAt: '2026-10-09T16:02:00Z' }, // Latest completion after reopening.
    { status: 'Pending', completedAt: '2026-10-09T16:03:00Z' },
    { status: 'Completed', updatedAt: '2026-10-09T15:59:00Z' },
    { status: 'Completed', completedAt: '2026-09-10T15:59:00Z' }, // Before window.
  ];
  const trend = buildCompletionTrend(tasks, now, 30);
  assert.equal(trend.length, 30);
  assert.equal(trend[0].date, '2026-09-11');
  assert.equal(trend.at(-1).date, '2026-10-10');
  assert.equal(trend.at(-1).count, 2);
  assert.equal(trend.at(-2).count, 1);
  assert.equal(trend.reduce((sum, day) => sum + day.count, 0), 3);
  assert.equal(completionWindow(now, 30).start.toISOString(), '2026-09-10T16:00:00.000Z');
});

test('report controller applies task visibility and Manila completion window without activity events', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-09T16:30:00Z') });
  const user = { _id: '507f1f77bcf86cd799439011', role: 'User' };
  let completionFilter;
  t.mock.method(Task, 'countDocuments', async () => 1);
  t.mock.method(Task, 'aggregate', async () => []);
  t.mock.method(Task, 'find', (filter) => {
    completionFilter = filter;
    return { select: () => ({ lean: async () => [{ status: 'Completed', completedAt: '2026-10-09T16:01:00Z' }] }) };
  });
  let result;
  await getReports({ user }, { json: (value) => { result = value.data; } });
  assert.equal(completionFilter.$and[0].$or[0].createdBy, user._id);
  assert.equal(completionFilter.$and[1].status, 'Completed');
  assert.equal(completionFilter.$and[2].$or[0].completedAt.$gte.toISOString(), '2026-09-10T16:00:00.000Z');
  assert.deepEqual(result.trend.at(-1), { date: '2026-10-10', count: 1 });
});

test('task filters and deadline notification queries use the same Manila day', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-09T16:30:00Z') });
  const filters = [];
  const chain = { select() { return this; }, populate() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [] };
  t.mock.method(Task, 'find', (filter) => { filters.push(filter); return chain; });
  t.mock.method(Task, 'countDocuments', async () => 0);
  t.mock.method(Task, 'distinct', async () => []);
  await listTasks({ user: { role: 'Admin' }, query: { dueDate: 'today' } }, { json() {} });
  assert.equal(filters[0].$and[0].dueDate.$gte.toISOString(), '2026-10-10T00:00:00.000Z');
  await syncDeadlineNotifications('507f1f77bcf86cd799439011');
  assert.equal(filters[1].$and[1].dueDate.$type, 'date');
  assert.equal(filters[1].$and[1].dueDate.$lte.toISOString(), '2026-10-12T00:00:00.000Z');
});
