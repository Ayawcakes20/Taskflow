import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeploymentConfig } from '../deploymentConfig.js';

test('Vercel routes API requests to the backend before applying the React Router fallback', () => {
  const config = createDeploymentConfig({ BACKEND_API_ORIGIN: 'https://backend.example.com' });
  assert.deepEqual(config.rewrites, [
    { source: '/api', destination: 'https://backend.example.com/api' },
    { source: '/api/:path*', destination: 'https://backend.example.com/api/:path*' },
    { source: '/:path*', destination: '/index.html' },
  ]);
  assert.equal(config.outputDirectory, 'dist');
  assert.match(config.installCommand, /corepack pnpm install --frozen-lockfile/);
});

test('Vercel configuration rejects absent, insecure or malformed backend origins without exposing values', () => {
  for (const BACKEND_API_ORIGIN of [undefined, 'http://localhost:5000', 'https://backend.example.com/',
    'https://backend.example.com/api', 'https://username:password@backend.example.com', 'invalid']) {
    assert.throws(() => createDeploymentConfig({ BACKEND_API_ORIGIN }), (error) => !error.message.includes('username:password'));
  }
});
