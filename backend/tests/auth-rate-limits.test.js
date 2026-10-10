import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAuthRateLimits } from '../middleware/authRateLimits.js';

async function fixture(t, options) {
  const app = express();
  app.use('/api/auth', createAuthRateLimits(options));
  app.use('/api/auth', (_req, res) => res.sendStatus(200));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return async (path, method = 'POST') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, { method });
    await response.text();
    return response;
  };
}

test('credential endpoints retain the shared 80-request brute-force limit without blocking session checks', async (t) => {
  const request = await fixture(t);
  for (let count = 0; count < 80; count++) assert.equal((await request('/login')).status, 200);
  for (const path of ['/login', '/register', '/password']) {
    assert.equal((await request(path, path === '/password' ? 'PUT' : 'POST')).status, 429);
  }
  assert.equal((await request('/me', 'GET')).status, 200);
  assert.equal((await request('/logout')).status, 200);
});

test('session checks remain rate limited and cannot consume credential protection', async (t) => {
  const request = await fixture(t, { sessionLimit: 2 });
  assert.equal((await request('/me', 'GET')).status, 200);
  assert.equal((await request('/logout')).status, 200);
  const limited = await request('/me', 'GET');
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal((await request('/login')).status, 200);
});
