import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { protect } from '../middleware/authMiddleware.js';
import { changePassword, login } from '../controllers/authController.js';
import { registerSchema, passwordChangeSchema } from '../utils/validation.js';

test('registration and password changes reject passwords over 72 UTF-8 bytes', () => {
  const credentials = { firstName: 'Audit', lastName: 'Test', username: 'audit', email: 'audit@example.com' };
  const boundary = `${'é'.repeat(35)}A1`;
  const overLimit = `${'é'.repeat(36)}A1`;
  assert.equal(Buffer.byteLength(boundary), 72);
  for (const [password, accepted] of [[boundary, true], [overLimit, false], ['a'.repeat(71) + '1', true], ['😀'.repeat(18) + 'A1', false]]) {
    assert.equal(registerSchema.safeParse({ ...credentials, password, confirmPassword: password }).success, accepted);
    assert.equal(passwordChangeSchema.safeParse({ currentPassword: 'oldPassword1', newPassword: password }).success, accepted);
  }
});

test('password changes rotate JWTs, reject old cookie/bearer sessions and preserve login', async (t) => {
  const secret = 'test-only-secret-'.repeat(3);
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  let version;
  const user = { _id: '507f1f77bcf86cd799439011', id: '507f1f77bcf86cd799439011', role: 'User', isActive: true,
    get sessionVersion() { return version; }, set sessionVersion(value) { version = value; },
    password: 'oldPassword1', comparePassword: async (password) => password === user.password, save: async () => {}, toJSON: () => ({ role: 'User' }) };
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  t.mock.method(User, 'findOne', () => ({ select: async () => user }));
  t.mock.method(ActivityLog, 'create', async () => ({}));
  const legacy = jwt.sign({ sub: user.id }, secret);
  const check = async (token, bearer = false) => {
    let error;
    const req = { cookies: bearer ? {} : { [process.env.SESSION_COOKIE_NAME || 'taskflow_session']: token }, headers: bearer ? { authorization: `Bearer ${token}` } : {} };
    await protect(req, {}, (value) => { error = value; });
    return error;
  };
  assert.equal(await check(legacy), undefined);
  assert.equal((await check('invalid-jwt')).statusCode, 401);
  assert.equal((await check(jwt.sign({ sub: user.id }, 'wrong-test-secret'))).statusCode, 401);
  let fresh;
  const res = { cookie: (_name, token) => { fresh = token; }, json: () => {} };
  await changePassword({ user, body: { currentPassword: 'oldPassword1', newPassword: 'newPassword2' } }, res);
  assert.equal(version, 1);
  assert.equal(user.password, 'newPassword2');
  assert.equal(jwt.verify(fresh, secret).sessionVersion, 1);
  assert.equal((await check(legacy)).statusCode, 401);
  assert.equal((await check(legacy, true)).statusCode, 401);
  assert.equal(await check(fresh), undefined);
  await login({ body: { identifier: 'audit', password: 'newPassword2' } }, res);
  assert.equal(jwt.verify(fresh, secret).sessionVersion, 1);
  assert.equal(await check(fresh, true), undefined);
  await assert.rejects(login({ body: { identifier: 'audit', password: 'oldPassword1' } }, res), (error) => error.statusCode === 401);
  await assert.rejects(changePassword({ user, body: { currentPassword: 'wrongPassword1', newPassword: 'anotherPassword3' } }, res), (error) => error.statusCode === 400);
  assert.equal(version, 1);
  const saved = new User({ firstName: 'Audit', lastName: 'Test', username: 'audit', email: 'audit@example.com', password: 'password1', sessionVersion: 2 });
  assert.equal(Object.hasOwn(saved.toJSON(), 'sessionVersion'), false);
});
