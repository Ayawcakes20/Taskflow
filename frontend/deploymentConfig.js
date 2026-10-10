export function createDeploymentConfig(env = process.env) {
  let backend;
  try {
    backend = new URL(env.BACKEND_API_ORIGIN);
    if (backend.protocol !== 'https:' || backend.origin !== env.BACKEND_API_ORIGIN
        || backend.username || backend.password) throw new Error();
  } catch { throw new Error('Set BACKEND_API_ORIGIN to the exact HTTPS origin of the backend Vercel project, without a trailing slash or /api.'); }
  return {
    framework: 'vite',
    installCommand: 'corepack pnpm install --frozen-lockfile',
    buildCommand: 'corepack pnpm build',
    outputDirectory: 'dist',
    rewrites: [
      { source: '/api', destination: `${backend.origin}/api` },
      { source: '/api/:path*', destination: `${backend.origin}/api/:path*` },
      { source: '/:path*', destination: '/index.html' },
    ],
    headers: [{ source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] }],
  };
}
