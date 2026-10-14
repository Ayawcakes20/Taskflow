// Explicit opt-in integration checks. No test can select the production database.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import express from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { connectDatabase } from '../config/db.js';
import { MongoRateLimitStore, RATE_LIMIT_COLLECTION } from '../utils/mongoRateLimitStore.js';
import { createAuthRateLimits } from '../middleware/authRateLimits.js';
import { errorMiddleware } from '../middleware/errorMiddleware.js';
import { databaseReady } from '../middleware/databaseReady.js';
import { emailDelivery } from '../utils/otpEmail.js';
import { OTP_COLLECTION } from '../utils/otpStore.js';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
const fingerprint = () => createHash('sha256').update(readFileSync(envFile)).digest('hex');
const originalEnv = fingerprint();
dotenv.config({ path: envFile });
process.env.MONGO_DB_NAME = 'taskflow_test';
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_ORIGIN = 'https://taskflow-test.example';
process.env.SESSION_COOKIE_SECURE = 'true';
process.env.SESSION_COOKIE_SAME_SITE = 'lax';
process.env.SESSION_COOKIE_NAME = 'taskflow_test_session';
process.env.VERCEL = '1'; // Exercise default-export mode, with no automatic listener.
const marker = `deploy_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const userNames = [`${marker}_a`, `${marker}_b`];
const counterIds = new Set();
const emailCodes = new Map();
const originalEmailSend = emailDelivery.send;
const originalEmailConfiguration = emailDelivery.assertConfigured;
const servers = [];
let vite;
let passed = 0;
let currentCheck = 'isolated test setup';
let ownsFixtures = false;

function isolated() {
  assert.equal(process.env.MONGO_DB_NAME, 'taskflow_test', 'Test environment isolation changed');
  assert.equal(mongoose.connection.db?.databaseName, 'taskflow_test', 'Refusing writes outside taskflow_test');
}

async function check(name, action) {
  currentCheck = name;
  await action();
  passed++;
  console.info(`PASS ${name}`);
}

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

try {
  assert.ok(process.env.MONGO_URI?.trim(), 'A usable MONGO_URI is required');
  assert.ok(!/[<>]/.test(process.env.MONGO_URI), 'Remove URI placeholders before testing');
  assert.equal(await connectDatabase(), true, 'Isolated MongoDB connection failed');
  isolated();
  await check('explicit taskflow_test connection and read-only ping', async () => {
    assert.equal((await mongoose.connection.db.command({ ping: 1 })).ok, 1);
  });

  // Email is mocked only inside this explicitly isolated opt-in script.
  emailDelivery.assertConfigured = () => { isolated(); };
  emailDelivery.send = async ({ email, code }) => { isolated(); emailCodes.set(email, code); };

  const { default: app } = await import('../server.js');
  const { default: User } = await import('../models/User.js');
  isolated();
  assert.equal(await User.countDocuments({ username: { $in: userNames } }), 0, 'Fixture name collision');
  ownsFixtures = true;
  const ip = `2001:db8:${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}::1`;
  const key = ipKeyGenerator(ip);
  for (const prefix of ['credentials', 'sessions', 'otp-requests', 'otp-verifications']) {
    const id = new MongoRateLimitStore(prefix).key(key);
    assert.equal(await mongoose.connection.db.collection(RATE_LIMIT_COLLECTION).findOne({ _id: id }), null, 'Fixture counter collision');
    counterIds.add(id);
  }
  const base = await listen(app);
  const request = async (path, { method = 'GET', cookie, body, origin = process.env.CLIENT_ORIGIN } = {}) => {
    isolated();
    const headers = { 'x-forwarded-for': ip, ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) };
    const response = await fetch(`${base}/api${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    return { status: response.status, headers: response.headers, data, text };
  };

  let cookie;
  let outsiderCookie;
  await check('direct registration sets secure JWT cookies without email delivery', async () => {
    for (const [index, username] of userNames.entries()) {
      const result = await request('/auth/register', { method: 'POST', body: {
        firstName: 'Deployment', lastName: 'Fixture', username, email: `${username}@example.invalid`, password: 'FixturePassword123!', confirmPassword: 'FixturePassword123!',
      } });
      assert.equal(result.status, 201);
      assert.equal(emailCodes.size, 0);
      const header = result.headers.get('set-cookie');
      assert.match(header, /HttpOnly/i);
      assert.match(header, /Secure/i);
      assert.match(header, /SameSite=Lax/i);
      if (index === 0) cookie = header.split(';')[0]; else outsiderCookie = header.split(';')[0];
    }
  });
  await check('valid login, persisted session and invalid JWT rejection', async () => {
    const login = await request('/auth/login', { method: 'POST', body: { identifier: userNames[0], password: 'FixturePassword123!' } });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/auth/me', { cookie })).status, 200);
    assert.equal((await request('/auth/me', { cookie: 'taskflow_test_session=invalid' })).status, 401);
    assert.equal((await request('/tasks')).status, 401);
    assert.equal((await request('/auth/login', { method: 'POST', body: { identifier: userNames[0], password: 'wrongPassword123!' } })).status, 401);
  });
  const image = 'data:image/png;base64,iVBORw0KGgo=';
  let taskId;
  await check('task images use same-origin URLs and retain visibility protection', async () => {
    const result = await request('/tasks', { method: 'POST', cookie, body: { title: marker, imageUrl: image, imageThumbnail: image } });
    assert.equal(result.status, 201);
    taskId = result.data.data.task._id;
    assert.ok(result.data.data.task.imageUrl.startsWith('/api/tasks/'));
    assert.equal((await request(`/tasks/${taskId}/image?variant=full`, { cookie })).status, 200);
    assert.equal((await request(`/tasks/${taskId}/image?variant=thumbnail`, { cookie: outsiderCookie })).status, 404);
    assert.equal((await request(`/tasks/${taskId}/image?variant=full`)).status, 401);
    const edited = await request(`/tasks/${taskId}`, { method: 'PUT', cookie, body: { title: `${marker} edited` } });
    assert.equal(edited.status, 200);
    assert.ok(edited.data.data.task.imageUrl.startsWith('/api/tasks/'));
    assert.equal((await request('/tasks', { cookie })).headers.get('cache-control'), 'no-store');
  });
  await check('untrusted origins and origin-less cookie mutations are rejected', async () => {
    assert.equal((await request('/auth/me', { cookie, origin: 'https://attacker.example' })).status, 403);
    assert.equal((await request(`/tasks/${taskId}`, { method: 'PUT', cookie, origin: null, body: { title: 'blocked' } })).status, 403);
  });
  await check('password change invalidates the previous JWT and returns a valid replacement', async () => {
    const changed = await request('/auth/password', { method: 'PUT', cookie, body: { currentPassword: 'FixturePassword123!', newPassword: 'UpdatedFixturePassword123!' } });
    assert.equal(changed.status, 200);
    assert.equal((await request('/auth/me', { cookie })).status, 401);
    cookie = changed.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/auth/me', { cookie })).status, 200);
  });
  await check('local Vite serves public deep links and proxies cookie-authenticated API and image requests', async () => {
    const frontendRoot = fileURLToPath(new URL('../../frontend/', import.meta.url));
    const require = createRequire(import.meta.url);
    const { createServer } = await import(pathToFileURL(require.resolve('vite', { paths: [frontendRoot] })).href);
    const previousTarget = process.env.API_PROXY_TARGET;
    process.env.API_PROXY_TARGET = base;
    try {
      vite = await createServer({ root: frontendRoot, server: { host: '127.0.0.1', port: 0, strictPort: false },
        optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
      await vite.listen();
      const address = vite.httpServer.address();
      const frontend = `http://127.0.0.1:${address.port}`;
      const page = await fetch(`${frontend}/tasks/${taskId}`);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /<div id="root">/);
      const headers = { cookie, origin: process.env.CLIENT_ORIGIN, 'x-forwarded-for': ip };
      const session = await fetch(`${frontend}/api/auth/me`, { headers });
      assert.equal(session.status, 200);
      await session.text();
      const picture = await fetch(`${frontend}/api/tasks/${taskId}/image?variant=full`, { headers });
      assert.equal(picture.status, 200);
      assert.equal(picture.headers.get('content-type'), 'image/png');
      await picture.arrayBuffer();
    } finally {
      if (vite) { await vite.close(); vite = undefined; }
      if (previousTarget === undefined) delete process.env.API_PROXY_TARGET; else process.env.API_PROXY_TARGET = previousTarget;
    }
  });
  await check('MongoDB counters share limits across two server instances and separate session checks', async () => {
    const prefix = `${marker}_rate`;
    const factory = (bucket) => new MongoRateLimitStore(`${prefix}_${bucket}`);
    for (const bucket of ['credentials', 'sessions']) counterIds.add(factory(bucket).key(ipKeyGenerator('127.0.0.1')));
    const make = () => {
      const fixture = express();
      fixture.use('/api/auth', createAuthRateLimits({ shared: true, credentialLimit: 2, sessionLimit: 2, storeFactory: factory }));
      fixture.use('/api/auth', (_req, res) => res.sendStatus(200));
      fixture.use(errorMiddleware);
      return fixture;
    };
    const a = await listen(make());
    const b = await listen(make());
    const hit = async (host, path, method = 'POST') => {
      isolated();
      const response = await fetch(`${host}/api/auth${path}`, { method });
      await response.text();
      return response;
    };
    assert.equal((await hit(a, '/login')).status, 200);
    assert.equal((await hit(b, '/login')).status, 200);
    assert.equal((await hit(a, '/login')).status, 429);
    assert.equal((await hit(b, '/me', 'GET')).status, 200);
    assert.equal((await hit(a, '/me', 'GET')).status, 200);
    assert.equal((await hit(b, '/me', 'GET')).status, 429);
    const collection = mongoose.connection.db.collection(RATE_LIMIT_COLLECTION);
    const expired = new MongoRateLimitStore(`${marker}_expiry`);
    expired.init({ windowMs: 900_000 });
    const counterId = expired.key('fixture');
    counterIds.add(counterId);
    await collection.insertOne({ _id: counterId, hits: 80, expiresAt: new Date(0) });
    assert.equal((await expired.increment('fixture')).totalHits, 1);
    const race = new MongoRateLimitStore(`${marker}_concurrent`);
    race.init({ windowMs: 900_000 });
    counterIds.add(race.key('fixture'));
    const results = await Promise.all(Array.from({ length: 8 }, () => race.increment('fixture')));
    assert.deepEqual(results.map(({ totalHits }) => totalHits).sort((left, right) => left - right), [1, 2, 3, 4, 5, 6, 7, 8]);
    const indexes = await collection.indexes();
    assert.ok(indexes.some((index) => index.name === 'auth_rate_limits_expiry' && index.expireAfterSeconds === 0));
  });
  await check('database failure response and next-request recovery', async () => {
    let available = false;
    const fixture = express();
    fixture.use('/api', databaseReady(async () => available));
    fixture.get('/api/tasks', (_req, res) => res.sendStatus(200));
    const host = await listen(fixture);
    const failed = await fetch(`${host}/api/tasks`);
    assert.equal(failed.status, 503);
    await failed.text();
    available = true;
    const recovered = await fetch(`${host}/api/tasks`);
    assert.equal(recovered.status, 200);
    await recovered.text();
  });
  await check('logout clears the cookie', async () => {
    const result = await request('/auth/logout', { method: 'POST', cookie });
    assert.equal(result.status, 200);
    assert.match(result.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
  });
  await check('local HTTP development retains non-Secure cookies and protected-route login', async () => {
    const saved = { NODE_ENV: process.env.NODE_ENV, CLIENT_ORIGIN: process.env.CLIENT_ORIGIN, SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE };
    process.env.NODE_ENV = 'development';
    process.env.CLIENT_ORIGIN = 'http://localhost:3000';
    process.env.SESSION_COOKIE_SECURE = 'false';
    try {
      const { default: localApp } = await import(`../server.js?local=${marker}`);
      const host = await listen(localApp);
      isolated();
      const response = await fetch(`${host}/api/auth/login`, { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: userNames[0], password: 'UpdatedFixturePassword123!' }) });
      assert.equal(response.status, 200);
      await response.text();
      const setCookie = response.headers.get('set-cookie');
      assert.doesNotMatch(setCookie, /; Secure/i);
      assert.match(setCookie, /HttpOnly/i);
      const session = await fetch(`${host}/api/auth/me`, { headers: { origin: 'http://localhost:3000', cookie: setCookie.split(';')[0] } });
      assert.equal(session.status, 200);
      await session.text();
    } finally { Object.assign(process.env, saved); }
  });
  await check('real driver outage returns false and reconnects to taskflow_test on the next attempt', async () => {
    isolated();
    const atlasUri = process.env.MONGO_URI;
    await mongoose.disconnect();
    try {
      process.env.MONGO_URI = 'mongodb://127.0.0.1:9/';
      assert.equal(await connectDatabase(), false);
    } finally { process.env.MONGO_URI = atlasUri; }
    assert.equal(await connectDatabase(), true);
    isolated();
    assert.equal((await mongoose.connection.db.command({ ping: 1 })).ok, 1);
  });
} catch (error) {
  // No driver exception, URI, cookie or JWT is written to terminal output.
  const category = error.name === 'AssertionError' ? 'assertion' : 'connectivity or configuration';
  console.error(`FAIL ${currentCheck} (${category}). Sensitive error details suppressed.`);
  process.exitCode = 1;
} finally {
  emailDelivery.send = originalEmailSend;
  emailDelivery.assertConfigured = originalEmailConfiguration;
  emailCodes.clear();
  try {
    if (vite) await vite.close();
    for (const server of servers) await new Promise((resolve) => server.close(resolve));
    if (ownsFixtures && mongoose.connection.readyState !== 1) await connectDatabase();
    if (ownsFixtures) {
      assert.equal(mongoose.connection.readyState, 1, 'Cannot reconnect for isolated cleanup');
      isolated();
      const db = mongoose.connection.db;
      // Exact names/IDs owned by this run only; never drop collections or the database.
      const registered = await db.collection('users').find({ username: { $in: userNames } }, { projection: { _id: 1 } }).toArray();
      const ids = registered.map((user) => user._id);
      await db.collection('tasks').deleteMany({ createdBy: { $in: ids }, title: { $in: [marker, `${marker} edited`] } });
      await db.collection('notifications').deleteMany({ user: { $in: ids } });
      await db.collection('activitylogs').deleteMany({ actor: { $in: ids } });
      await db.collection('users').deleteMany({ _id: { $in: ids }, username: { $in: userNames } });
      await db.collection(OTP_COLLECTION).deleteMany({ email: { $in: userNames.map((username) => `${username}@example.invalid`) } });
      await db.collection(RATE_LIMIT_COLLECTION).deleteMany({ _id: { $in: [...counterIds] } });
      console.info('Isolated fixtures removed from taskflow_test; existing records retained.');
    }
  } catch {
    console.error('Isolated fixture cleanup failed. Retain test fixtures for review; no broad cleanup was attempted.');
    process.exitCode = 1;
  }
  await mongoose.disconnect().catch(() => { process.exitCode = 1; console.error('Test database disconnect failed; details suppressed.'); });
  assert.equal(fingerprint(), originalEnv, 'backend/.env changed during testing');
  console.info(`Integration checks passed: ${passed}.`);
}
