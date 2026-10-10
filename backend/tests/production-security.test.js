import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionConfig, trustedOrigins } from '../config/production.js';
import { trustedOrigin } from '../middleware/trustedOrigin.js';
import { MongoRateLimitStore } from '../utils/mongoRateLimitStore.js';
import { errorMiddleware } from '../middleware/errorMiddleware.js';

const production = { NODE_ENV: 'production', MONGO_URI: 'mongodb+srv://fixture.invalid/', MONGO_DB_NAME: 'taskflow_test',
  JWT_SECRET: 'test-only-production-validation-secret-123', CLIENT_ORIGIN: 'https://frontend.example.com' };

test('production requires explicit database, strong JWT, exact HTTPS origins and secure cookies', () => {
  assert.doesNotThrow(() => validateProductionConfig(production));
  for (const key of ['MONGO_URI', 'MONGO_DB_NAME', 'JWT_SECRET', 'CLIENT_ORIGIN']) {
    assert.throws(() => validateProductionConfig({ ...production, [key]: '' }), new RegExp(key));
  }
  for (const overrides of [{ MONGO_URI: 'not-a-uri' }, { MONGO_URI: 'mongodb+srv://<user>:<password>@fixture.invalid/' },
    { JWT_SECRET: 'short' }, { CLIENT_ORIGIN: 'http://frontend.example.com' }, { CLIENT_ORIGIN: 'https://frontend.example.com/path' },
    { CLIENT_ORIGIN: 'https://frontend.example.com,' }, { SESSION_COOKIE_SECURE: 'false' }, { SESSION_COOKIE_SAME_SITE: 'invalid' }]) {
    assert.throws(() => validateProductionConfig({ ...production, ...overrides }));
  }
  assert.doesNotThrow(() => validateProductionConfig({ NODE_ENV: 'development' }));
  assert.equal(trustedOrigins(production).has('http://localhost:3000'), false);
  assert.equal(trustedOrigins({}).has('http://localhost:3000'), true);
});

test('origin policy rejects untrusted origins and origin-less cookie mutations while retaining bearer clients', () => {
  const check = (headers, method = 'POST', cookies = {}) => {
    let error;
    trustedOrigin(new Set(['https://frontend.example.com']), true)({ headers, method, cookies }, {}, (value) => { error = value; });
    return error;
  };
  assert.equal(check({ origin: 'https://frontend.example.com' }), undefined);
  assert.equal(check({ origin: 'https://attacker.manus.space' }).statusCode, 403);
  assert.equal(check({}, 'POST', { taskflow_session: 'fixture' }).statusCode, 403);
  assert.equal(check({}, 'GET', { taskflow_session: 'fixture' }), undefined);
  assert.equal(check({ authorization: 'Bearer fixture' }, 'POST', { taskflow_session: 'fixture' }), undefined);
});

test('shared MongoDB counters use an atomic update, hashed keys and a single expiry index', async () => {
  const calls = [];
  const collection = {
    createIndex: async (...args) => { calls.push(['index', ...args]); },
    findOneAndUpdate: async (...args) => { calls.push(['increment', ...args]); return { hits: calls.filter(([type]) => type === 'increment').length, expiresAt: new Date(900_000) }; },
    updateOne: async (...args) => { calls.push(['decrement', ...args]); },
    deleteOne: async (...args) => { calls.push(['reset', ...args]); },
  };
  const options = { collection: () => collection, now: () => new Date(0) };
  const first = new MongoRateLimitStore('credentials', options);
  const second = new MongoRateLimitStore('credentials', options);
  const sessions = new MongoRateLimitStore('sessions', options);
  for (const store of [first, second, sessions]) store.init({ windowMs: 900_000 });
  assert.equal((await first.increment('fixture-client')).totalHits, 1);
  assert.equal((await second.increment('fixture-client')).totalHits, 2);
  assert.equal(first.key('fixture-client'), second.key('fixture-client'));
  assert.notEqual(first.key('fixture-client'), sessions.key('fixture-client'));
  assert.equal(first.key('fixture-client').includes('fixture-client'), false);
  await first.decrement('fixture-client');
  await first.resetKey('fixture-client');
  assert.equal(calls.filter(([type]) => type === 'index').length, 1);
  assert.deepEqual(calls[0].slice(1), [{ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'auth_rate_limits_expiry' }]);
  const increment = calls.find(([type]) => type === 'increment');
  assert.ok(Array.isArray(increment[2]));
  assert.equal(increment[3].upsert, true);
  assert.equal(increment[3].returnDocument, 'after');
});

test('rate-limit insert races retry against the winning document and outages fail closed', async () => {
  let count = 0;
  const collection = { createIndex: async () => {}, findOneAndUpdate: async (_query, _update, options) => {
    if (++count === 1) throw Object.assign(new Error('duplicate'), { code: 11000 });
    assert.equal(options.upsert, undefined);
    return { hits: 2, expiresAt: new Date() };
  } };
  const store = new MongoRateLimitStore('credentials', { collection: () => collection });
  store.init({ windowMs: 900_000 });
  assert.equal((await store.increment('client')).totalHits, 2);
  const unavailable = new MongoRateLimitStore('credentials', { collection: () => { throw new Error('sensitive-test-marker'); } });
  await assert.rejects(unavailable.increment('client'), (error) => error.statusCode === 503 && !error.message.includes('sensitive-test-marker'));
});

test('production server failures expose no stack, internal details or sensitive error message', (t) => {
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before; });
  const logs = t.mock.method(console, 'error', () => {});
  const error = Object.assign(new Error('sensitive-test-marker'), { details: { connection: 'sensitive-test-marker' } });
  let response;
  const res = { status(code) { assert.equal(code, 500); return this; }, json(body) { response = body; } };
  errorMiddleware(error, {}, res, () => {});
  assert.equal(JSON.stringify(response).includes('sensitive-test-marker'), false);
  assert.equal(JSON.stringify(logs.mock.calls).includes('sensitive-test-marker'), false);
});
