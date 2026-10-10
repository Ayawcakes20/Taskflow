import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/User.js';
import { updatePreferences } from '../controllers/userController.js';

test('single notification preference updates preserve the other preferences', async (t) => {
  const user = new User({ preferences: { theme: 'dark', notifications: { assignments: true, updates: true, deadlines: false, mentions: true } } });
  t.mock.method(user, 'save', async () => user);
  t.mock.method(User, 'findById', async () => user);
  await updatePreferences({ user, body: { notifications: { assignments: false } } }, { json() {} });
  assert.deepEqual(user.preferences.notifications.toObject(), { assignments: false, updates: true, deadlines: false, mentions: true });
  assert.equal(user.preferences.theme, 'dark');
});
