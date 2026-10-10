import test from 'node:test';
import assert from 'node:assert/strict';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import ActivityLog from '../models/ActivityLog.js';
import { addTaskComment, updateTaskComment } from '../controllers/taskController.js';

test('creating and editing mentions scope @everyone and usernames to participants or admins', async (t) => {
  const creator = '507f1f77bcf86cd799439011';
  const assignee = '507f1f77bcf86cd799439012';
  const legacy = '507f1f77bcf86cd799439013';
  const admin = '507f1f77bcf86cd799439014';
  const outsider = '507f1f77bcf86cd799439015';
  const task = new Task({ title: 'Private task', createdBy: creator, assignedUsers: [assignee], assignedUser: legacy });
  t.mock.method(task, 'save', async () => task);
  t.mock.method(Task, 'findOne', async () => task);
  const chain = { populate() { return this; }, lean: async () => task.toObject() };
  t.mock.method(Task, 'findById', () => chain);
  t.mock.method(ActivityLog, 'create', async () => ({}));
  const candidates = [creator, assignee, legacy, admin, outsider].map((_id, index) => ({ _id, username: ['creator', 'assignee', 'legacy', 'admin', 'outsider'][index], role: _id === admin ? 'Admin' : 'User' }));
  t.mock.method(User, 'find', (filter) => {
    assert.equal(filter.isActive, true);
    assert.deepEqual(filter.$or, [{ role: 'Admin' }, { _id: { $in: [creator, legacy, assignee] } }]);
    return { select: () => ({ lean: async () => candidates.filter((person) =>
      (person.role === 'Admin' || filter.$or[1]._id.$in.includes(person._id)) && (!filter.username || filter.username.$in.includes(person.username))) }) };
  });
  t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ isActive: true }) }) }));
  const recipients = [];
  t.mock.method(Notification, 'create', async (notification) => { if (notification.type === 'mention') recipients.push(String(notification.user)); return notification; });
  const req = { user: { _id: creator, firstName: 'Creator', role: 'User' }, params: { id: String(task._id) }, body: { content: '@everyone private update' } };
  await addTaskComment(req, { status() { return this; }, json() {} });
  assert.deepEqual(recipients.sort(), [assignee, legacy, admin].sort());
  assert.equal(task.comments[0].mentions.map(String).includes(outsider), false);
  recipients.length = 0;
  await updateTaskComment({ ...req, params: { ...req.params, commentId: String(task.comments[0]._id) }, body: { content: '@outsider @assignee @admin' } }, { json() {} });
  assert.deepEqual(recipients.sort(), [assignee, admin].sort());
  assert.equal(task.comments[0].mentions.map(String).includes(outsider), false);
});
