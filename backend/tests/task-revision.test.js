import test from 'node:test';
import assert from 'node:assert/strict';
import { taskBulkSchema, taskCommentSchema, taskSchema, taskUpdateSchema } from '../utils/validation.js';
import { validateImageDataUri } from '../utils/taskImages.js';
import { buildCompletionTrend, sortRecentTasks } from '../utils/dashboardState.js';
import { statusAfterSubtaskChange, subtaskProgress, subtasksChanged } from '../utils/taskSubtasks.js';
import { applyDashboardTaskUpdate } from '../../frontend/src/utils/dashboardState.js';
import { hasValidDueDate, isUpcomingDeadline } from '../../frontend/src/utils/taskDates.js';
import { statusAfterSubtaskChange as clientStatusAfterSubtaskChange, subtaskProgress as clientSubtaskProgress } from '../../frontend/src/utils/taskSubtasks.js';

const validId = '64c000000000000000000001';
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngData = `data:image/png;base64,${pngSignature.toString('base64')}`;

function blankDashboard() {
  return {
    stats: { total: 2, pending: 1, inProgress: 0, completed: 1, overdue: 0 },
    breakdown: { status: [{ _id: 'Pending', count: 1 }, { _id: 'Completed', count: 1 }], priority: [{ _id: 'Medium', count: 2 }] },
    completionTrend: Array.from({ length: 7 }, (_, index) => {
      const date = new Date('2026-10-08T00:00:00.000Z');
      date.setUTCDate(date.getUTCDate() - 6 + index);
      return { date: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' }), count: date.toISOString().slice(0, 10) === '2026-10-07' ? 1 : 0 };
    }),
    upcomingDeadlines: [],
    recentTasks: [{ _id: 'other', title: 'Active', status: 'Pending', priority: 'Low', updatedAt: '2026-10-08T09:00:00.000Z' }],
  };
}

test('task create/update accept multiple assignees and an explicit clear-all assignment', () => {
  const parsed = taskSchema.parse({ title: 'Shared task', assignedUsers: [validId, '64c000000000000000000002'] });
  assert.deepEqual(parsed.assignedUsers, [validId, '64c000000000000000000002']);
  assert.deepEqual(taskUpdateSchema.parse({ assignedUsers: [] }), { assignedUsers: [] });
  assert.deepEqual(taskUpdateSchema.parse({ assignedUser: null }), { assignedUser: null });
  assert.equal(taskUpdateSchema.safeParse({ assignedUsers: ['not-a-mongo-id'] }).success, false);
});

test('Select All assignment payloads accept the directory maximum of 250 active members', () => {
  const assignees = Array.from({ length: 250 }, (_, index) => (index + 1).toString(16).padStart(24, '0'));
  assert.equal(taskSchema.safeParse({ title: 'All-member task', assignedUsers: assignees }).success, true);
  assert.equal(taskUpdateSchema.safeParse({ assignedUsers: assignees }).success, true);
  assert.equal(taskBulkSchema.safeParse({ action: 'assign', taskIds: [validId], assignedUsers: assignees }).success, true);
  const tooMany = [...assignees, '64c000000000000000000001'];
  assert.equal(taskSchema.safeParse({ title: 'Over-limit task', assignedUsers: tooMany }).success, false);
});

test('image validation checks supported raster signatures and the decoded size limit', () => {
  assert.equal(validateImageDataUri(pngData), pngData);
  assert.throws(() => validateImageDataUri('data:image/png;base64,aGVsbG8='), /contents do not match/i);
  const tooLarge = Buffer.alloc(1024 * 1024 + 1, 0).toString('base64');
  assert.throws(() => validateImageDataUri(`data:image/jpeg;base64,${tooLarge}`), /must be 1024 KB or smaller/i);
  assert.throws(() => validateImageDataUri('data:image/svg+xml;base64,PHN2Zz4='), /valid JPEG, PNG, or WebP/i);
});

test('weekly completed-work trend counts only currently completed tasks and supports legacy records', () => {
  const now = new Date('2026-10-08T13:00:00.000Z');
  const tasks = [
    { status: 'Completed', completedAt: '2026-10-07T10:00:00.000Z', updatedAt: '2026-10-07T10:00:00.000Z' },
    { status: 'Completed', updatedAt: '2026-10-08T11:00:00.000Z' },
    { status: 'Pending', completedAt: '2026-10-08T09:00:00.000Z', updatedAt: '2026-10-08T12:00:00.000Z' },
    { status: 'Completed', completedAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z' },
  ];
  const trend = buildCompletionTrend(tasks, now);
  assert.equal(trend.find((day) => day.date === '2026-10-07').count, 1);
  assert.equal(trend.find((day) => day.date === '2026-10-08').count, 1);
  assert.equal(trend.length, 7);
});

test('Recent Tasks ordering places active work above completed work with a stable updated-time order', () => {
  const rows = sortRecentTasks([
    { _id: 'completed', status: 'Completed', updatedAt: '2026-10-08T12:00:00.000Z' },
    { _id: 'progress', status: 'In Progress', updatedAt: '2026-10-08T08:00:00.000Z' },
    { _id: 'pending-old', status: 'Pending', updatedAt: '2026-10-07T08:00:00.000Z' },
    { _id: 'pending-new', status: 'Pending', updatedAt: '2026-10-08T09:00:00.000Z' },
  ]);
  assert.deepEqual(rows.map((task) => task._id), ['pending-new', 'pending-old', 'progress', 'completed']);
});

test('dashboard state reopens a task, restores its deadline and removes its completion count immediately', () => {
  const now = new Date('2026-10-08T12:00:00.000Z');
  const previous = { _id: 'task-1', title: 'Reversible work', status: 'Completed', priority: 'Medium', dueDate: '2026-10-10T00:00:00.000Z', completedAt: '2026-10-07T10:00:00.000Z', updatedAt: '2026-10-07T10:00:00.000Z' };
  const reopened = { ...previous, status: 'Pending', completedAt: null, updatedAt: '2026-10-08T12:00:00.000Z' };
  const result = applyDashboardTaskUpdate(blankDashboard(), previous, reopened, now);
  assert.equal(result.stats.pending, 2);
  assert.equal(result.stats.completed, 0);
  assert.equal(result.breakdown.status.find((item) => item._id === 'Completed'), undefined);
  assert.equal(result.completionTrend.find((day) => day.date === '2026-10-07').count, 0);
  assert.equal(result.upcomingDeadlines[0]._id, 'task-1');
  assert.equal(result.recentTasks[0]._id, 'task-1');

  const completed = { ...reopened, status: 'Completed', completedAt: '2026-10-08T12:00:00.000Z', updatedAt: '2026-10-08T12:00:00.000Z' };
  const completedDashboard = applyDashboardTaskUpdate(result, reopened, completed, now);
  assert.equal(completedDashboard.stats.pending, 1);
  assert.equal(completedDashboard.stats.completed, 1);
  assert.equal(completedDashboard.completionTrend.find((day) => day.date === '2026-10-08').count, 1);
  assert.equal(completedDashboard.upcomingDeadlines.length, 0);
  assert.equal(completedDashboard.recentTasks.at(-1)._id, 'task-1');
});


test('failed optimistic completion restores dashboard counts, trend, ordering, and due eligibility', () => {
  const now = new Date('2026-10-08T12:00:00.000Z');
  const active = {
    _id: 'task-rollback', title: 'Reversible work', status: 'Pending', priority: 'High',
    dueDate: '2026-10-10T00:00:00.000Z', completedAt: null, updatedAt: '2026-10-07T09:00:00.000Z',
  };
  const otherCompleted = {
    _id: 'other-completed', title: 'Finished work', status: 'Completed', priority: 'Medium',
    completedAt: '2026-10-07T10:00:00.000Z', updatedAt: '2026-10-07T10:00:00.000Z',
  };
  const initial = blankDashboard();
  initial.stats = { total: 2, pending: 1, inProgress: 0, completed: 1, overdue: 0 };
  initial.breakdown = { status: [{ _id: 'Pending', count: 1 }, { _id: 'Completed', count: 1 }], priority: [{ _id: 'High', count: 1 }, { _id: 'Medium', count: 1 }] };
  initial.upcomingDeadlines = [active];
  initial.recentTasks = [active, otherCompleted];

  const optimistic = { ...active, status: 'Completed', completedAt: now.toISOString(), updatedAt: now.toISOString() };
  const optimisticDashboard = applyDashboardTaskUpdate(initial, active, optimistic, now);
  assert.equal(optimisticDashboard.stats.pending, 0);
  assert.equal(optimisticDashboard.stats.completed, 2);
  assert.equal(optimisticDashboard.upcomingDeadlines.length, 0);
  assert.equal(optimisticDashboard.completionTrend.find((day) => day.date === '2026-10-08').count, 1);

  const restored = applyDashboardTaskUpdate(optimisticDashboard, optimistic, active, now);
  assert.equal(restored.stats.pending, 1);
  assert.equal(restored.stats.completed, 1);
  assert.equal(restored.breakdown.status.find((item) => item._id === 'Pending').count, 1);
  assert.equal(restored.breakdown.status.find((item) => item._id === 'Completed').count, 1);
  assert.equal(restored.completionTrend.find((day) => day.date === '2026-10-08').count, 0);
  assert.equal(restored.upcomingDeadlines[0]._id, active._id);
  assert.equal(restored.recentTasks[0]._id, active._id);
});


test('deadlines safely exclude missing and invalid dates and use the current seven-day task state', () => {
  const now = new Date('2026-10-08T12:00:00.000Z');
  for (const dueDate of [null, undefined, '', 'not-a-date']) {
    assert.equal(hasValidDueDate({ dueDate }), false);
    assert.equal(isUpcomingDeadline({ dueDate, status: 'Pending' }, now), false);
  }
  assert.equal(isUpcomingDeadline({ dueDate: '2026-10-08', status: 'Pending' }, now), true);
  assert.equal(isUpcomingDeadline({ dueDate: '2026-10-14', status: 'In Progress' }, now), true);
  assert.equal(isUpcomingDeadline({ dueDate: '2026-10-15', status: 'Pending' }, now), false);
  assert.equal(isUpcomingDeadline({ dueDate: '2026-10-10', status: 'Completed' }, now), false);
});

test('subtask schema permits optional checklists, preserves ids, and reports nonzero-only progress', () => {
  const created = taskSchema.parse({ title: 'Checklist task', subtasks: [{ title: 'First', completed: true }, { title: 'Second' }] });
  assert.deepEqual(created.subtasks.map((item) => item.completed), [true, false]);
  const updated = taskUpdateSchema.parse({ subtasks: [{ _id: validId, title: 'First', completed: true }] });
  assert.equal(updated.subtasks[0]._id, validId);
  assert.equal(subtasksChanged([{ _id: validId, title: 'First', completed: false }], updated.subtasks), true);
  assert.deepEqual(subtaskProgress([]), { total: 0, completed: 0, percent: null });
  assert.deepEqual(subtaskProgress(created.subtasks), { total: 2, completed: 1, percent: 50 });
  assert.deepEqual(clientSubtaskProgress(created.subtasks), { total: 2, completed: 1, percent: 50 });
  assert.equal(taskUpdateSchema.safeParse({ subtasks: [{ title: '   ', completed: false }] }).success, false);
  assert.equal(taskUpdateSchema.safeParse({ subtasks: Array.from({ length: 101 }, (_, index) => ({ title: `Item ${index}` })) }).success, false);
});

test('subtask completion transitions are deterministic, reversible, and consistent between browser and API', () => {
  const cases = [
    ['Pending', [], 'Pending'],
    ['Pending', [{ completed: false }], 'Pending'],
    ['Pending', [{ completed: true }, { completed: false }], 'In Progress'],
    ['In Progress', [{ completed: true }, { completed: false }], 'In Progress'],
    ['Pending', [{ completed: true }, { completed: true }], 'Completed'],
    ['Completed', [{ completed: true }, { completed: false }], 'In Progress'],
  ];
  for (const [status, subtasks, expected] of cases) {
    assert.equal(statusAfterSubtaskChange(status, subtasks), expected);
    assert.equal(clientStatusAfterSubtaskChange(status, subtasks), expected);
  }
});

test('comment content is trimmed, bounded, and rejects blank input', () => {
  assert.deepEqual(taskCommentSchema.parse({ content: '  Confirmed with the team.  ' }), { content: 'Confirmed with the team.' });
  assert.equal(taskCommentSchema.safeParse({ content: '  ' }).success, false);
  assert.equal(taskCommentSchema.safeParse({ content: 'x'.repeat(5001) }).success, false);
  assert.equal(taskCommentSchema.safeParse({ content: 'Note', extra: true }).success, false);
});

test('bulk operations are allowlisted, bounded, and reject duplicated task ids', () => {
  assert.deepEqual(taskBulkSchema.parse({ action: 'priority', taskIds: [validId], priority: 'High' }), { action: 'priority', taskIds: [validId], priority: 'High' });
  assert.deepEqual(taskBulkSchema.parse({ action: 'assign', taskIds: [validId], assignedUsers: [] }).assignedUsers, []);
  assert.equal(taskBulkSchema.safeParse({ action: 'complete', taskIds: [validId, validId] }).success, false);
  assert.equal(taskBulkSchema.safeParse({ action: 'priority', taskIds: [validId], priority: 'Urgent' }).success, false);
  assert.equal(taskBulkSchema.safeParse({ action: 'delete', taskIds: [] }).success, false);
  assert.equal(taskBulkSchema.safeParse({ action: 'complete', taskIds: Array.from({ length: 101 }, (_, index) => (index + 1).toString(16).padStart(24, '0')) }).success, false);
});

test('dashboard deadline eligibility follows date edits and clearing without retaining stale task ids', () => {
  const now = new Date('2026-10-08T12:00:00.000Z');
  const previous = { _id: 'deadline-task', status: 'Pending', priority: 'Medium', dueDate: null, updatedAt: '2026-10-07T09:00:00.000Z' };
  const withDeadline = { ...previous, dueDate: '2026-10-12T00:00:00.000Z', updatedAt: now.toISOString() };
  const inserted = applyDashboardTaskUpdate(blankDashboard(), previous, withDeadline, now);
  assert.equal(inserted.upcomingDeadlines[0]._id, previous._id);
  const withoutDeadline = { ...withDeadline, dueDate: null, updatedAt: now.toISOString() };
  const removed = applyDashboardTaskUpdate(inserted, withDeadline, withoutDeadline, now);
  assert.equal(removed.upcomingDeadlines.some((task) => task._id === previous._id), false);
});
