import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import authRoutes from '../routes/authRoutes.js';
import { register, login, logout } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { emailDelivery } from '../utils/otpEmail.js';
import { otpService } from '../utils/otpService.js';
import { errorMiddleware } from '../middleware/errorMiddleware.js';

const values = { firstName: 'Defense', lastName: 'Fixture', username: 'defense_fixture', email: 'defense@example.invalid', password: 'IsolatedFixture123!', confirmPassword: 'IsolatedFixture123!' };
function setup(t) {
  const before = process.env.JWT_SECRET; process.env.JWT_SECRET = 'isolated-rollback-test-secret-'.repeat(3);
  t.after(() => { if (before === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = before; });
  t.mock.method(ActivityLog, 'create', async () => ({}));
  t.mock.method(emailDelivery, 'send', async () => { throw new Error('Registration must not use SMTP'); });
  t.mock.method(emailDelivery, 'assertConfigured', () => { throw new Error('Registration must not need SMTP configuration'); });
}

test('direct registration hashes the password and establishes a cookie session that survives verification and login', async (t) => {
  setup(t); let token; let options; let response; let persisted;
  t.mock.method(User, 'findOne', () => ({ select: async () => null }));
  t.mock.method(User.collection, 'insertOne', async (record) => { persisted = record; return { acknowledged: true }; });
  const res = { cookie: (_name, value, settings) => { token = value; options = settings; }, status(code) { assert.equal(code, 201); return this; }, json(body) { response = body; } };
  await register({ body: { ...values, username: values.username.toUpperCase(), email: values.email.toUpperCase() } }, res);
  assert.ok(persisted.password !== values.password && persisted.password.startsWith('$2'));
  assert.equal(persisted.username, values.username); assert.equal(persisted.email, values.email);
  assert.equal(response.data.user.password, undefined); assert.equal(response.data.challengeId, undefined);
  assert.equal(options.httpOnly, true);
  const user = new User(persisted); t.mock.method(User, 'findById', () => ({ select: async () => user }));
  let error; await protect({ cookies: { [process.env.SESSION_COOKIE_NAME || 'taskflow_session']: token }, headers: {} }, {}, (problem) => { error = problem; });
  assert.equal(error, undefined); assert.equal(jwt.verify(token, process.env.JWT_SECRET).sub, user.id);
  t.mock.method(User, 'findOne', () => ({ select: async () => user }));
  await login({ body: { identifier: values.username, password: values.password } }, { cookie: res.cookie, json() {} });
  let cleared = false; await logout({ cookies: {}, headers: {} }, { clearCookie() { cleared = true; }, json() {} });
  assert.equal(cleared, true);
});

test('direct registration preserves duplicate checks without creating a user', async (t) => {
  setup(t); let writes = 0; t.mock.method(User, 'create', async () => { writes++; });
  for (const duplicate of [{ email: values.email }, { username: values.username }]) {
    t.mock.method(User, 'findOne', () => ({ select: async () => duplicate }));
    await assert.rejects(register({ body: values }, {}), (error) => error.statusCode === 409);
  }
  assert.equal(writes, 0);
});

test('direct registration rejects weak, oversized or mismatched passwords before database writes', async (t) => {
  setup(t); let writes = 0; t.mock.method(User, 'create', async () => { writes++; });
  for (const body of [{ ...values, password: 'short' }, { ...values, password: 'é'.repeat(36) + 'A1', confirmPassword: 'é'.repeat(36) + 'A1' }, { ...values, confirmPassword: 'Mismatch123!' }]) {
    await assert.rejects(register({ body }, {}), (error) => error.name === 'ZodError');
  }
  assert.equal(writes, 0);
});

test('registration OTP endpoints remain disabled while direct registration stays active', async (t) => {
  setup(t); const app = express(); app.use(express.json()); app.use('/api/auth', authRoutes);
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  for (const path of ['/register/verify', '/register/resend']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: 'a'.repeat(64), resetToken: 'b'.repeat(64), ...values }) });
    assert.equal(response.status, 503); assert.match((await response.json()).message, /disabled/); assert.equal(response.headers.get('set-cookie'), null);
  }
});

test('recovery routes require the existing code/grant workflow and never issue a login cookie', async (t) => {
  setup(t); const calls = [];
  const challengeId = 'a'.repeat(64); const resetToken = 'b'.repeat(64);
  t.mock.method(otpService, 'issue', async (purpose, email) => { calls.push({ action: 'issue', purpose, email }); return { challengeId }; });
  t.mock.method(otpService, 'resend', async (id, purpose) => { calls.push({ action: 'resend', id, purpose }); return { challengeId }; });
  t.mock.method(otpService, 'verifyRecovery', async (id) => { calls.push({ action: 'verify', id }); return { resetToken }; });
  t.mock.method(otpService, 'resetPassword', async (id, token) => { if (token !== resetToken) throw Object.assign(new Error('Invalid reset grant'), { statusCode: 400 }); calls.push({ action: 'reset', id }); });
  const app = express(); app.use(express.json()); app.use('/api/auth', authRoutes); app.use(errorMiddleware);
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = async (path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.headers.get('set-cookie'), null);
    return { status: response.status, body: await response.json() };
  };
  const issued = await request('/forgot-password', { email: values.email.toUpperCase() });
  assert.equal(issued.status, 202); assert.match(issued.body.message, /If an eligible account/);
  assert.equal((await request('/forgot-password/resend', { challengeId })).status, 200);
  assert.equal((await request('/forgot-password/verify', { challengeId, code: '123456' })).status, 200);
  const reset = { challengeId, resetToken, newPassword: values.password, confirmPassword: values.password };
  assert.equal((await request('/reset-password', { ...reset, resetToken: 'c'.repeat(64) })).status, 400);
  assert.equal((await request('/reset-password', { ...reset, resetToken: undefined })).status, 400);
  assert.equal((await request('/reset-password', reset)).status, 200);
  assert.deepEqual(calls.map((call) => call.action), ['issue', 'resend', 'verify', 'reset']);
  assert.equal(calls[0].purpose, 'recovery'); assert.equal(calls[0].email, values.email);
  assert.equal(calls[1].purpose, 'recovery');
});
