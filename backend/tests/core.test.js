import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex, paginationFrom, sortFrom } from '../utils/query.js';
import { preferencesSchema, registerSchema, taskSchema, taskUpdateSchema } from '../utils/validation.js';
import { dateOnlyKey, formatDueDate, isDueDateOverdue, relativeDate } from '../../frontend/src/utils/format.js';

const validRegistration = {
  firstName: 'Avery', lastName: 'Morgan', username: 'avery.morgan', email: 'avery@example.com',
  password: 'securePass123', confirmPassword: 'securePass123',
};

test('registration accepts strong credentials and matching confirmation', () => {
  const parsed = registerSchema.parse(validRegistration);
  assert.equal(parsed.username, 'avery.morgan');
  assert.equal(parsed.email, 'avery@example.com');
});

test('registration rejects mismatched passwords, weak password, and malformed email', () => {
  assert.equal(registerSchema.safeParse({ ...validRegistration, confirmPassword: 'differentPass123' }).success, false);
  assert.equal(registerSchema.safeParse({ ...validRegistration, password: 'short', confirmPassword: 'short' }).success, false);
  assert.equal(registerSchema.safeParse({ ...validRegistration, email: 'not-an-email' }).success, false);
});

test('task validation applies useful defaults and accepts date-only values', () => {
  const parsed = taskSchema.parse({ title: 'Review launch checklist', dueDate: '2026-10-07' });
  assert.equal(parsed.priority, 'Medium');
  assert.equal(parsed.status, 'Pending');
  assert.equal(parsed.category, 'General');
  assert.equal(parsed.dueDate, '2026-10-07');
  assert.equal(taskSchema.safeParse({ title: 'Task', status: 'Queued' }).success, false);
});

test('partial task updates do not apply creation defaults to omitted fields', () => {
  assert.deepEqual(taskUpdateSchema.parse({ status: 'Completed' }), { status: 'Completed' });
  assert.deepEqual(taskUpdateSchema.parse({ dueDate: '' }), { dueDate: null });
  assert.equal(taskUpdateSchema.safeParse({ priority: 'Urgent' }).success, false);
  assert.equal(taskUpdateSchema.safeParse({}).success, false);
});

test('notification settings accept only supported preferences', () => {
  assert.deepEqual(preferencesSchema.parse({ theme: 'dark', notifications: { assignments: false, deadlines: true } }), {
    theme: 'dark', notifications: { assignments: false, deadlines: true },
  });
  assert.equal(preferencesSchema.safeParse({ theme: 'sepia' }).success, false);
});

test('search escapes regex syntax and treats it as a literal phrase', () => {
  const term = 'a.*(b)[x]';
  const expression = new RegExp(escapeRegex(term), 'i');
  assert.equal(expression.test('A.*(B)[X]'), true);
  assert.equal(expression.test('axxxb'), false);
});

test('pagination clamps negative, oversized, and unsafe values', () => {
  assert.deepEqual(paginationFrom({ page: '-4', limit: '1000' }), { page: 1, limit: 100, skip: 0 });
  assert.deepEqual(paginationFrom({ page: '3', limit: '25' }), { page: 3, limit: 25, skip: 50 });
  assert.equal(paginationFrom({ page: '999999999999999999999999999' }).page, 1);
});

test('sort fields are allowlisted, including inherited property names', () => {
  assert.deepEqual(sortFrom({ sortBy: '__proto__', order: 'asc' }), { dueDate: 1, _id: -1 });
  assert.deepEqual(sortFrom({ sortBy: 'constructor', order: 'desc' }), { dueDate: -1, _id: -1 });
  assert.deepEqual(sortFrom({ sortBy: 'title', order: 'asc' }), { title: 1, _id: -1 });
});


test('date-only task due dates keep the selected calendar day and do not become overdue early', () => {
  const due = '2026-10-07T00:00:00.000Z';
  assert.equal(dateOnlyKey(due), '2026-10-07');
  assert.equal(formatDueDate(due, { month: 'long', day: 'numeric', year: 'numeric' }), 'October 7, 2026');
  assert.equal(isDueDateOverdue(due, new Date('2026-10-07T23:59:00+08:00')), false);
  assert.equal(isDueDateOverdue(due, new Date('2026-10-08T00:01:00+08:00')), true);
  assert.equal(relativeDate('2026-10-08', new Date('2026-10-07T23:59:00+08:00')), 'Tomorrow');
});
