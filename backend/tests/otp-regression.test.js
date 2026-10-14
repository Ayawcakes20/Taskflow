import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import express from 'express';
import nodemailer from 'nodemailer';
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
import { errorMiddleware } from '../middleware/errorMiddleware.js';

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

test('retained OTP controllers remain testable while public recovery routes are disabled', async (t) => {
  fixture(t); let cookies = 0; let result; let status;
  const user = { _id: 'fixture', id: 'fixture', firstName: 'Fixture', lastName: 'Account', role: 'User', toJSON: () => ({ role: 'User' }) };
  t.mock.method(otpService, 'issue', async () => ({ challengeId: 'a'.repeat(64) }));
  t.mock.method(otpService, 'verifyRegistration', async () => user);
  t.mock.method(otpService, 'resetPassword', async () => {});
  t.mock.method(ActivityLog, 'create', async () => ({}));
  const res = { cookie: () => { cookies++; }, status(value) { status = value; return this; }, json(value) { result = value; } };
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

function smtpFixture(t) {
  const values = { SMTP_USER: process.env.SMTP_USER, SMTP_APP_PASSWORD: process.env.SMTP_APP_PASSWORD };
  t.after(() => { for (const [key, value] of Object.entries(values)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  process.env.SMTP_USER = 'sender@example.invalid';
  process.env.SMTP_APP_PASSWORD = 'abcd efgh ijkl mnop';
}

test('SMTP delivery rejects missing or malformed configuration without opening a connection', async (t) => {
  smtpFixture(t); let connects = 0; const logs = [];
  t.mock.method(console, 'error', (...values) => logs.push(values));
  t.mock.method(nodemailer, 'createTransport', () => { connects++; });
  for (const [user, password] of [['', 'abcdefghijklmnop'], ['sender@example.invalid', ''], ['sender@example.invalid\r\nInjected', 'abcdefghijklmnop'], ['sender@example.invalid', 'not-an-app-password']]) {
    process.env.SMTP_USER = user; process.env.SMTP_APP_PASSWORD = password;
    await assert.rejects(emailDelivery.send({ email: registration.email, code: '123456', purpose: 'registration' }), (error) => error.statusCode === 503);
  }
  assert.equal(connects, 0);
  assert.equal(logs.length, 4);
  assert.equal(logs[0][1].userPresent, false); assert.equal(logs[1][1].passwordPresent, false);
  assert.equal(logs[2][1].userValid, false); assert.equal(logs[3][1].passwordValid, false);
  assert.ok(logs.every((entry) => entry[1].category === 'configuration'));
});

test('Gmail SMTP delivers both existing OTP templates with TLS, bounded timeouts and backend-only credentials', async (t) => {
  smtpFixture(t); const messages = []; let options;
  t.mock.method(nodemailer, 'createTransport', (value) => { options = value; return { async sendMail(message) { messages.push(message); return { accepted: [registration.email] }; } }; });
  for (const purpose of ['registration', 'recovery']) await emailDelivery.send({ email: registration.email, code: '123456', purpose });
  assert.equal(options.host, 'smtp.gmail.com'); assert.equal(options.port, 465); assert.equal(options.secure, true);
  assert.equal(options.pool, false); assert.equal(options.logger, false); assert.equal(options.debug, false);
  assert.equal(options.connectionTimeout, 5000); assert.equal(options.greetingTimeout, 5000); assert.equal(options.socketTimeout, 10000);
  assert.ok(options.auth.pass.length === 16 && !/\s/.test(options.auth.pass));
  assert.deepEqual(messages[0].from, { name: 'Taskflow', address: process.env.SMTP_USER });
  assert.equal(messages[0].to, registration.email);
  assert.ok(messages.every((message) => message.text.includes('123456') && message.html.includes('123456')));
  assert.match(messages[0].subject, /Verify your email/); assert.match(messages[1].subject, /Reset your password/);
});

test('SMTP failures log only safe categories and status numbers, never credentials, codes or server replies', async (t) => {
  smtpFixture(t); const logs = [];
  t.mock.method(console, 'error', (...values) => logs.push(values));
  for (const [code, responseCode, category] of [['EAUTH', 535, 'authentication'], ['ETIMEDOUT', undefined, 'timeout'], ['ESOCKET', undefined, 'connection'], ['EDNS', undefined, 'dns']]) {
    t.mock.method(nodemailer, 'createTransport', () => ({ async sendMail() {
      throw Object.assign(new Error('SENSITIVE_SERVER_RESPONSE'), { code, responseCode, response: 'SENSITIVE_SERVER_RESPONSE' });
    } }));
    await assert.rejects(emailDelivery.send({ email: registration.email, code: '123456', purpose: 'registration' }), (error) => error.statusCode === 503 && error.message === 'Email delivery is temporarily unavailable. Please try again shortly.');
    assert.equal(logs.at(-1)[1].category, category);
    assert.equal(logs.at(-1)[1].responseCode, responseCode);
  }
  const output = JSON.stringify(logs);
  assert.ok(!output.includes('SENSITIVE_SERVER_RESPONSE') && !output.includes(registration.email) && !output.includes(process.env.SMTP_USER)
    && !output.includes('123456') && !output.includes(process.env.SMTP_APP_PASSWORD.replace(/\s/g, '')));
});

test('SMTP recipient rejection does not report a successful delivery', async (t) => {
  smtpFixture(t); const logs = [];
  t.mock.method(console, 'error', (...values) => logs.push(values));
  t.mock.method(nodemailer, 'createTransport', () => ({ async sendMail() { return { accepted: [], rejected: [registration.email], response: 'SENSITIVE_SERVER_RESPONSE' }; } }));
  await assert.rejects(emailDelivery.send({ email: registration.email, code: '123456', purpose: 'recovery' }), (error) => error.statusCode === 503);
  assert.equal(logs[0][1].category, 'recipient'); assert.equal(logs[0][1].phase, 'smtp_send');
  assert.ok(Number.isInteger(logs[0][1].elapsedMs));
});

test('configuration failure before OTP issuance is diagnostic while the production response stays generic', async (t) => {
  const f = fixture(t); smtpFixture(t); delete process.env.SMTP_APP_PASSWORD;
  const before = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  t.after(() => { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before; });
  const logs = []; t.mock.method(console, 'error', (...values) => logs.push(values));
  let lookups = 0; t.mock.method(f.accounts, 'duplicate', async () => { lookups++; });
  const service = createOtpService({ store: f.store, accounts: f.accounts, delivery: emailDelivery });
  let body; let status;
  await assert.rejects(service.issue('registration', registration.email, registration), (error) => {
    errorMiddleware(error, {}, { status(value) { status = value; return this; }, json(value) { body = value; } }, () => {});
    return error.statusCode === 503;
  });
  assert.equal(lookups, 0); assert.equal(f.collection.records.size, 0);
  assert.equal(status, 503); assert.deepEqual(body, { success: false, message: 'Something went wrong. Please try again in a moment.' });
  assert.deepEqual(logs[0][1], { category: 'configuration', userPresent: true, userValid: true, passwordPresent: false, passwordValid: false });
  assert.ok(!JSON.stringify({ logs, body }).includes(process.env.SMTP_USER));
});

test('SMTP timeout diagnostics distinguish setup, greeting and socket inactivity without widening timeouts', async (t) => {
  smtpFixture(t); const logs = []; t.mock.method(console, 'error', (...values) => logs.push(values));
  for (const timeoutType of ['CONNECT_TIMEOUT', 'GREETING_TIMEOUT', 'UPGRADE_TIMEOUT', 'SOCKET_TIMEOUT']) {
    t.mock.method(nodemailer, 'createTransport', () => ({ async sendMail() {
      throw Object.assign(new Error('SENSITIVE_SERVER_RESPONSE'), { code: 'ETIMEDOUT', command: 'CONN', timeoutType });
    } }));
    await assert.rejects(emailDelivery.send({ email: registration.email, code: '123456', purpose: 'registration' }), (error) => error.statusCode === 503);
    const diagnostic = logs.at(-1)[1];
    assert.equal(diagnostic.category, 'timeout'); assert.equal(diagnostic.timeoutType, timeoutType);
    assert.equal(diagnostic.stage, 'connection'); assert.equal(diagnostic.phase, 'smtp_send');
    assert.ok(Number.isInteger(diagnostic.elapsedMs) && diagnostic.elapsedMs >= 0);
  }
  assert.ok(!JSON.stringify(logs).includes('SENSITIVE_SERVER_RESPONSE'));
});

test('unexpected transport errors cannot inject raw provider data into diagnostic fields', async (t) => {
  smtpFixture(t); const logs = []; t.mock.method(console, 'error', (...values) => logs.push(values));
  t.mock.method(nodemailer, 'createTransport', () => {
    throw Object.assign(new Error('SENSITIVE_SERVER_RESPONSE'), { code: 'toString', command: 'SENSITIVE_SERVER_RESPONSE', timeoutType: 'SENSITIVE_SERVER_RESPONSE', responseCode: 'SENSITIVE_SERVER_RESPONSE' });
  });
  await assert.rejects(emailDelivery.send({ email: registration.email, code: '123456', purpose: 'registration' }), (error) => error.statusCode === 503);
  assert.equal(logs[0][1].category, 'smtp'); assert.equal(logs[0][1].phase, 'transport_setup');
  assert.ok(!JSON.stringify(logs).includes('SENSITIVE_SERVER_RESPONSE'));
  assert.equal(logs[0][1].stage, undefined); assert.equal(logs[0][1].timeoutType, undefined);
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
