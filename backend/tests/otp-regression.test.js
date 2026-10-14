import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import express from 'express';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { OtpStore } from '../utils/otpStore.js';
import { accountActions, createOtpService, otpService } from '../utils/otpService.js';
import { emailDelivery } from '../utils/otpEmail.js';
import { register, login, logout } from '../controllers/authController.js';
import { verifyRegistration, forgotPassword, resetPassword } from '../controllers/otpController.js';
import { protect } from '../middleware/authMiddleware.js';
import { passwordResetSchema, registerSchema } from '../utils/validation.js';
import { createOtpRateLimits } from '../middleware/authRateLimits.js';

const registration = { firstName: 'Isolated', lastName: 'Fixture', username: 'otp_fixture', email: 'otp@example.invalid', password: 'IsolatedFixture123!', confirmPassword: 'IsolatedFixture123!' };
const clone = (value) => structuredClone(value);
function matches(record, query) {
  return Object.entries(query).every(([key, condition]) => {
    if (key === '$or') return condition.some((item) => matches(record, item));
    const value = record[key];
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      return Object.entries(condition).every(([op, expected]) => ({ $gt: () => value > expected, $lt: () => value < expected, $ne: () => value !== expected, $exists: () => (value !== undefined) === expected }[op])());
    }
    return value === condition;
  });
}
class MemoryCollection {
  records = new Map(); indexes = [];
  async createIndex(fields, options) { this.indexes.push({ fields, options }); }
  async findOne(query) { return clone([...this.records.values()].find((record) => matches(record, query)) || null); }
  async insertOne(record) {
    if (this.records.has(record._id)) throw Object.assign(new Error('Duplicate fixture'), { code: 11000 });
    this.records.set(record._id, clone(record));
  }
  change(query, update) {
    const record = [...this.records.values()].find((item) => matches(item, query));
    if (!record) return null;
    Object.assign(record, clone(update.$set || {}));
    for (const key of Object.keys(update.$unset || {})) delete record[key];
    for (const [key, value] of Object.entries(update.$inc || {})) record[key] = (record[key] || 0) + value;
    return clone(record);
  }
  async findOneAndUpdate(query, update) { return this.change(query, update); }
  async updateOne(query, update) { return { modifiedCount: this.change(query, update) ? 1 : 0 }; }
}
function fixture(t) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-otp-test-secret-'.repeat(3);
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  let time = Date.now();
  const collection = new MemoryCollection();
  const store = new OtpStore({ collection: () => collection, now: () => time });
  const sent = [];
  const users = [];
  let failDelivery = false;
  const accounts = {
    async duplicate(email, username) { return users.find((user) => user.email === email || user.username === username); },
    async recoveryUser(email) { return users.find((user) => user.email === email && user.isActive); },
    async create(values) {
      if (await accounts.duplicate(values.email, values.username)) throw Object.assign(new Error('Duplicate fixture'), { code: 11000 });
      const user = { ...values, _id: '507f1f77bcf86cd799439011', sessionVersion: 0, isActive: true };
      users.push(user); return user;
    },
    async reset(record, hash) {
      const user = users.find((item) => item._id === record.userId && item.isActive && (item.sessionVersion ?? 0) === record.sessionVersion);
      if (!user) return null;
      user.passwordHash = hash; user.sessionVersion = (user.sessionVersion ?? 0) + 1; return user;
    },
  };
  const delivery = { assertConfigured() {}, async send(item) { if (failDelivery) throw Object.assign(new Error('Mock email failure'), { statusCode: 503 }); sent.push(item); } };
  const service = createOtpService({ store, accounts, delivery, now: () => time });
  return { collection, service, users, sent, accounts, store, advance: (ms) => { time += ms; }, fail: () => { failDelivery = true; } };
}
const invalid = (error) => error.statusCode === 400;
const wrong = (code) => code === '000000' ? '111111' : '000000';

test('registration stores only keyed code digests and bcrypt hashes and creates no premature account', async (t) => {
  const f = fixture(t);
  const challenge = await f.service.issue('registration', registration.email, registration);
  const record = await f.store.get(challenge.challengeId, 'registration');
  assert.equal(f.users.length, 0); assert.equal(f.sent.length, 1);
  assert.ok(/^\d{6}$/.test(f.sent[0].code));
  assert.ok(record.otpHash !== f.sent[0].code);
  assert.equal(record.registration.password, undefined); assert.equal(record.registration.confirmPassword, undefined);
  assert.ok(await bcrypt.compare(registration.password, record.registration.passwordHash));
  assert.equal(record.otpExpiresAt - record.resendAt, 240000);
  assert.deepEqual(f.collection.indexes[0], { fields: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: 'auth_otp_expiry' } });
});

test('correct registration code creates one account and cannot be replayed or raced', async (t) => {
  const f = fixture(t); const challenge = await f.service.issue('registration', registration.email, registration);
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => f.service.verifyRegistration(challenge.challengeId, f.sent[0].code)));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(f.users.length, 1);
  assert.equal((await f.store.get(challenge.challengeId, 'registration')).registration, undefined);
  await assert.rejects(f.service.verifyRegistration(challenge.challengeId, f.sent[0].code), invalid);
});

test('five wrong guesses lock an issued code even under concurrent attempts', async (t) => {
  const f = fixture(t); const challenge = await f.service.issue('registration', registration.email, registration);
  await Promise.allSettled(Array.from({ length: 9 }, () => f.service.verifyRegistration(challenge.challengeId, wrong(f.sent[0].code))));
  assert.equal((await f.store.get(challenge.challengeId, 'registration')).attempts, 5);
  await assert.rejects(f.service.verifyRegistration(challenge.challengeId, f.sent[0].code), invalid);
  assert.equal(f.users.length, 0);
});

test('expired codes cannot verify before TTL cleanup, resend rotates challenge and enforces cooldown', async (t) => {
  const f = fixture(t); const challenge = await f.service.issue('registration', registration.email, registration);
  await assert.rejects(f.service.resend(challenge.challengeId, 'registration'), (error) => error.statusCode === 429 && error.details.retryAfterSeconds === 60);
  f.advance(300000);
  await assert.rejects(f.service.verifyRegistration(challenge.challengeId, f.sent[0].code), invalid);
  const next = await f.service.resend(challenge.challengeId, 'registration');
  assert.notEqual(next.challengeId, challenge.challengeId);
  await assert.rejects(f.service.verifyRegistration(challenge.challengeId, f.sent[0].code), invalid);
  await f.service.verifyRegistration(next.challengeId, f.sent[1].code);
  assert.equal(f.users.length, 1);
});

test('concurrent resend requests deliver once and per-address requests are bounded hourly', async (t) => {
  const f = fixture(t); let challenge = await f.service.issue('registration', registration.email, registration);
  f.advance(60000);
  const results = await Promise.allSettled([f.service.resend(challenge.challengeId, 'registration'), f.service.resend(challenge.challengeId, 'registration')]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(f.sent.length, 2);
  challenge = results.find((result) => result.status === 'fulfilled').value;
  for (let i = 0; i < 4; i++) { f.advance(60000); challenge = await f.service.resend(challenge.challengeId, 'registration'); }
  f.advance(60000);
  await assert.rejects(f.service.resend(challenge.challengeId, 'registration'), (error) => error.statusCode === 429);
});

test('duplicate email or username is rejected before issuance and checked again at verification', async (t) => {
  const f = fixture(t); f.users.push({ ...registration });
  await assert.rejects(f.service.issue('registration', registration.email, registration), (error) => error.statusCode === 409);
  await assert.rejects(f.service.issue('registration', 'another@example.invalid', registration), (error) => error.statusCode === 409);
  assert.equal(f.sent.length, 0);
  f.users.length = 0;
  const challenge = await f.service.issue('registration', registration.email, registration);
  f.users.push({ ...registration });
  await assert.rejects(f.service.verifyRegistration(challenge.challengeId, f.sent[0].code), (error) => error.statusCode === 409);
  assert.equal(f.users.length, 1);
});

test('failed registration delivery cannot activate an account and can be restarted after cooldown', async (t) => {
  const f = fixture(t); f.fail();
  await assert.rejects(f.service.issue('registration', registration.email, registration), (error) => error.statusCode === 503);
  const record = [...f.collection.records.values()][0];
  assert.equal(record.status, 'failed'); assert.equal(record.otpHash, undefined); assert.equal(record.registration, undefined);
  assert.equal(f.users.length, 0);
});

test('recovery acknowledgements match for known and unknown accounts, including delivery failures', async (t) => {
  const f = fixture(t); f.users.push({ _id: 'fixture', email: registration.email, isActive: true });
  const known = await f.service.issue('recovery', registration.email);
  const unknown = await f.service.issue('recovery', 'missing@example.invalid');
  assert.deepEqual(Object.keys(known), Object.keys(unknown)); assert.equal(f.sent.length, 1);
  f.advance(60000); f.fail();
  const failed = await f.service.resend(known.challengeId, 'recovery');
  assert.deepEqual(Object.keys(known), Object.keys(failed));
  assert.equal((await f.store.get(failed.challengeId, 'recovery')).status, 'failed');
});

test('verified recovery grants are hashed, expire, are single-use and invalidate all old sessions', async (t) => {
  const f = fixture(t); const user = { _id: '507f1f77bcf86cd799439011', id: '507f1f77bcf86cd799439011', email: registration.email, isActive: true, role: 'User', sessionVersion: 0 };
  f.users.push(user);
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  const oldToken = jwt.sign({ sub: user.id, sessionVersion: 0 }, process.env.JWT_SECRET);
  const challenge = await f.service.issue('recovery', registration.email);
  await assert.rejects(f.service.resetPassword(challenge.challengeId, '0'.repeat(64), registration.password), invalid);
  const grant = await f.service.verifyRecovery(challenge.challengeId, f.sent[0].code);
  assert.ok((await f.store.get(challenge.challengeId, 'recovery')).resetTokenHash !== grant.resetToken);
  await assert.rejects(f.service.verifyRecovery(challenge.challengeId, f.sent[0].code), invalid);
  const outcomes = await Promise.allSettled([f.service.resetPassword(challenge.challengeId, grant.resetToken, registration.password), f.service.resetPassword(challenge.challengeId, grant.resetToken, registration.password)]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(user.sessionVersion, 1); assert.ok(await bcrypt.compare(registration.password, user.passwordHash));
  let rejected; await protect({ cookies: {}, headers: { authorization: `Bearer ${oldToken}` } }, {}, (error) => { rejected = error; });
  assert.equal(rejected.statusCode, 401);
  f.advance(60000); const next = await f.service.issue('recovery', registration.email);
  const nextGrant = await f.service.verifyRecovery(next.challengeId, f.sent.at(-1).code);
  f.advance(300000); await assert.rejects(f.service.resetPassword(next.challengeId, nextGrant.resetToken, registration.password), invalid);
});

test('a recovery issued before an intervening password change cannot overwrite the newer password', async (t) => {
  const f = fixture(t); f.users.push({ _id: 'fixture', email: registration.email, isActive: true, sessionVersion: 3 });
  const challenge = await f.service.issue('recovery', registration.email);
  const grant = await f.service.verifyRecovery(challenge.challengeId, f.sent[0].code);
  f.users[0].sessionVersion++;
  await assert.rejects(f.service.resetPassword(challenge.challengeId, grant.resetToken, registration.password), invalid);
  assert.equal(f.users[0].passwordHash, undefined);
});

test('OTP validation reuses bcrypt byte limits, confirmation and registration validation', () => {
  const base = { challengeId: 'a'.repeat(64), resetToken: 'b'.repeat(64) };
  assert.equal(passwordResetSchema.safeParse({ ...base, newPassword: registration.password, confirmPassword: registration.password }).success, true);
  assert.equal(passwordResetSchema.safeParse({ ...base, newPassword: 'é'.repeat(36) + 'A1', confirmPassword: 'é'.repeat(36) + 'A1' }).success, false);
  assert.equal(passwordResetSchema.safeParse({ ...base, newPassword: registration.password, confirmPassword: 'different' }).success, false);
  assert.equal(registerSchema.safeParse({ ...registration, username: 'invalid!' }).success, false);
});

test('registration controller sets no cookie until verification; recovery reset never logs in', async (t) => {
  fixture(t); let cookies = 0; let result; let status;
  const user = { _id: 'fixture', id: 'fixture', firstName: 'Fixture', lastName: 'Account', role: 'User', toJSON: () => ({ role: 'User' }) };
  t.mock.method(otpService, 'issue', async () => ({ challengeId: 'a'.repeat(64) }));
  t.mock.method(otpService, 'verifyRegistration', async () => user);
  t.mock.method(otpService, 'resetPassword', async () => {});
  t.mock.method(ActivityLog, 'create', async () => ({}));
  const res = { cookie: () => { cookies++; }, status(value) { status = value; return this; }, json(value) { result = value; } };
  await register({ body: registration }, res); assert.equal(cookies, 0); assert.equal(status, 202); assert.equal(result.data.user, undefined);
  await verifyRegistration({ body: { challengeId: 'a'.repeat(64), code: '123456' } }, res); assert.equal(cookies, 1); assert.equal(status, 201);
  await resetPassword({ body: { challengeId: 'a'.repeat(64), resetToken: 'b'.repeat(64), newPassword: registration.password, confirmPassword: registration.password } }, res); assert.equal(cookies, 1);
  await forgotPassword({ body: { email: registration.email } }, res); assert.match(result.message, /If an eligible account/);
});

test('existing accounts keep password-only login and logout without email-verification fields', async (t) => {
  fixture(t); let cookies = 0; let cleared = 0;
  const user = { _id: 'fixture', id: 'fixture', isActive: true, role: 'User', comparePassword: async () => true, toJSON: () => ({ role: 'User' }) };
  t.mock.method(User, 'findOne', () => ({ select: async () => user }));
  t.mock.method(ActivityLog, 'create', async () => ({}));
  const res = { cookie: () => { cookies++; }, clearCookie: () => { cleared++; }, json() {} };
  await login({ body: { identifier: 'legacy', password: registration.password } }, res);
  await logout({ cookies: {}, headers: {} }, res);
  assert.equal(cookies, 1); assert.equal(cleared, 1);
});

test('prehashed registration uses the existing user model without double hashing', async (t) => {
  const hash = await bcrypt.hash(registration.password, 12);
  t.mock.method(User.collection, 'insertOne', async () => ({ acknowledged: true }));
  const { password: _password, confirmPassword: _confirm, ...values } = registration;
  const user = await accountActions.create({ ...values, passwordHash: hash });
  assert.ok(user.password === hash); assert.ok(await user.comparePassword(registration.password));
  assert.equal(user.toJSON().password, undefined);
});

test('recovery update atomically increments sessionVersion and supports legacy missing versions', async (t) => {
  let filter; let update;
  t.mock.method(User, 'findOneAndUpdate', async (query, change) => { filter = query; update = change; return {}; });
  await accountActions.reset({ userId: 'fixture', sessionVersion: 0 }, 'hashed-fixture');
  assert.equal(filter.isActive, true); assert.ok(filter.$or.some((entry) => entry.sessionVersion?.$exists === false));
  assert.deepEqual(update.$inc, { sessionVersion: 1 });
});

test('email delivery refuses missing configuration and sanitizes provider failures without a fake success', async (t) => {
  const values = { RESEND_API_KEY: process.env.RESEND_API_KEY, OTP_EMAIL_FROM: process.env.OTP_EMAIL_FROM };
  t.after(() => { for (const [key, value] of Object.entries(values)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  delete process.env.RESEND_API_KEY; delete process.env.OTP_EMAIL_FROM;
  assert.throws(() => emailDelivery.assertConfigured(), (error) => error.statusCode === 503);
  process.env.RESEND_API_KEY = 'mock-only'; process.env.OTP_EMAIL_FROM = 'Taskflow <fixture@example.invalid>';
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  await assert.rejects(emailDelivery.send({ email: registration.email, code: '123456', purpose: 'registration', challengeId: 'fixture' }), (error) => error.statusCode === 503 && !error.message.includes('mock-only'));
});

test('OTP request and verification limits are separate and use existing shared production stores', async (t) => {
  const prefixes = []; const storeFactory = (prefix) => { prefixes.push(prefix); return { localKeys: false, init() {}, async increment() { return { totalHits: 1, resetTime: new Date(Date.now() + 60000) }; }, async decrement() {}, async resetKey() {} }; };
  createOtpRateLimits({ shared: true, storeFactory }); assert.deepEqual(prefixes, ['otp-requests', 'otp-verifications']);
  const limits = createOtpRateLimits({ shared: false, requestLimit: 1, verificationLimit: 2 });
  const app = express(); app.post('/request', limits.requests, (_req, res) => res.sendStatus(200)); app.post('/verify', limits.verifications, (_req, res) => res.sendStatus(200));
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = (path) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST' });
  assert.equal((await request('/request')).status, 200); assert.equal((await request('/request')).status, 429);
  assert.equal((await request('/verify')).status, 200); assert.equal((await request('/verify')).status, 200); assert.equal((await request('/verify')).status, 429);
});
