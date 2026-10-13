import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const environment of [{ NODE_ENV: 'production' }, { NODE_ENV: 'development', VERCEL: '1' }]) {
  test(`UI fixture refuses ${environment.VERCEL ? 'Vercel' : 'production'} execution`, () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./ui-fixture-server.mjs', import.meta.url))], {
      env: { ...process.env, ...environment }, encoding: 'utf8', timeout: 15000,
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /The local UI fixture must not run in production/);
  });
}
