import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

// No live database or credentials: every connection attempt is mocked.
process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.MONGO_URI = 'mongodb://fixture.invalid/taskflow_test';
process.env.MONGO_DB_NAME = 'taskflow_test';
const { default: app } = await import('../server.js');

async function fixture(t) {
  const previousState = mongoose.connection._readyState;
  mongoose.connection._readyState = 0;
  t.after(() => { mongoose.connection._readyState = previousState; });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return () => fetch(`http://127.0.0.1:${server.address().port}/api/health`);
}

test('Vercel cold-start health awaits the pending connection and reuses a warm connection', async (t) => {
  const request = await fixture(t);
  let finish;
  let started;
  const connecting = new Promise((resolve) => { started = resolve; });
  const connect = t.mock.method(mongoose, 'connect', (_uri, options) => {
    assert.equal(options.dbName, 'taskflow_test');
    started();
    return new Promise((resolve) => { finish = () => {
      mongoose.connection._readyState = 1;
      resolve(mongoose);
    }; });
  });
  let responded = false;
  const pending = request().then((response) => { responded = true; return response; });
  await connecting;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(responded, false);
  finish();
  const response = await pending;
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).database, 'connected');
  const warm = await request();
  assert.equal((await warm.json()).database, 'connected');
  assert.equal(connect.mock.callCount(), 1);
});

test('health preserves liveness on failure, hides driver details and retries on the next request', async (t) => {
  const request = await fixture(t);
  t.mock.method(console, 'warn', () => {});
  let attempts = 0;
  const connect = t.mock.method(mongoose, 'connect', async () => {
    if (++attempts === 1) throw new Error('sensitive-test-marker');
    mongoose.connection._readyState = 1;
    return mongoose;
  });
  const unavailable = await request();
  assert.equal(unavailable.status, 200);
  assert.deepEqual(await unavailable.json(), {
    success: true, service: 'taskflow-api', database: 'unavailable',
  });
  const recovered = await request();
  assert.equal((await recovered.json()).database, 'connected');
  assert.equal(connect.mock.callCount(), 2);
});
