export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const required = ['MONGO_URI', 'MONGO_DB_NAME', 'JWT_SECRET', 'CLIENT_ORIGIN'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}.`);
  if (env.JWT_SECRET.length < 32 || /replace|placeholder|change.me/i.test(env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a strong production secret of at least 32 characters.');
  }
  try {
    const uri = new URL(env.MONGO_URI);
    if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol) || !uri.hostname || /[<>]/.test(env.MONGO_URI)) throw new Error();
  } catch { throw new Error('MONGO_URI must be a valid MongoDB connection URI.'); }
  if (!/^[a-zA-Z0-9_-]+$/.test(env.MONGO_DB_NAME)) throw new Error('MONGO_DB_NAME must be an explicit database name.');
  for (const origin of env.CLIENT_ORIGIN.split(',').map((value) => value.trim())) {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw new Error();
    } catch { throw new Error('CLIENT_ORIGIN must contain exact HTTPS origins separated by commas.'); }
  }
  if (env.SESSION_COOKIE_SECURE === 'false') throw new Error('Production session cookies must be Secure.');
  if (env.SESSION_COOKIE_SAME_SITE && !['lax', 'strict', 'none'].includes(env.SESSION_COOKIE_SAME_SITE.toLowerCase())) {
    throw new Error('SESSION_COOKIE_SAME_SITE must be lax, strict, or none.');
  }
}

export function trustedOrigins(env = process.env) {
  const configured = (env.CLIENT_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
  return new Set(env.NODE_ENV === 'production' ? configured : [...configured, 'http://localhost:3000', 'http://127.0.0.1:3000']);
}
