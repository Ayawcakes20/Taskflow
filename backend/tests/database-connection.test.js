import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { databaseReady } from '../middleware/databaseReady.js';

test('MongoDB concurrent requests share a pending connection, use a small pool and reuse warm connections', async (t) => {
  const previousState = mongoose.connection._readyState;
  mongoose.connection._readyState = 0;
  t.after(() => { mongoose.connection._readyState = previousState; });
  let finish;
  const connect = t.mock.method(mongoose, 'connect', (_uri, options) => {
    assert.equal(options.maxPoolSize, 5);
    assert.equal(options.minPoolSize, 0);
    assert.equal(options.maxIdleTimeMS, 60_000);
    return new Promise((resolve) => { finish = () => { mongoose.connection._readyState = 1; resolve(true); }; });
  });
  const first = connectDatabase();
  const second = connectDatabase();
  assert.equal(first, second);
  await Promise.resolve();
  finish();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(await connectDatabase(), true);
  assert.equal(connect.mock.callCount(), 1);
});

test('failed MongoDB connections are sanitized and retried by the next request without timers', async (t) => {
  const previousState = mongoose.connection._readyState;
  mongoose.connection._readyState = 0;
  t.after(() => { mongoose.connection._readyState = previousState; });
  const warning = t.mock.method(console, 'warn', () => {});
  const connect = t.mock.method(mongoose, 'connect', async () => { throw new Error('sensitive-test-marker'); });
  assert.equal(await connectDatabase(), false);
  assert.equal(await connectDatabase(), false);
  assert.equal(connect.mock.callCount(), 2);
  assert.ok(warning.mock.calls.every(({ arguments: args }) => !args.join('').includes('sensitive-test-marker')));
});

test('database readiness returns recoverable 503 and preserves offline logout and health', async () => {
  let status;
  let body;
  let retryAfter;
  const res = { setHeader: (_name, value) => { retryAfter = value; }, status(code) { status = code; return this; }, json(value) { body = value; } };
  const middleware = databaseReady(async () => false);
  let nextCalls = 0;
  await middleware({ path: '/tasks', method: 'GET' }, res, () => nextCalls++);
  assert.equal(status, 503);
  assert.equal(retryAfter, '3');
  assert.equal(body.success, false);
  assert.equal(nextCalls, 0);
  await middleware({ path: '/health', method: 'GET' }, res, () => nextCalls++);
  await middleware({ path: '/auth/logout', method: 'POST' }, res, () => nextCalls++);
  await databaseReady(async () => true)({ path: '/tasks', method: 'GET' }, res, () => nextCalls++);
  assert.equal(nextCalls, 3);
});
