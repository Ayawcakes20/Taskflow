import { rateLimit } from 'express-rate-limit';
import { MongoRateLimitStore } from '../utils/mongoRateLimitStore.js';
import { isDatabaseReady } from '../config/db.js';

export function createAuthRateLimits({ credentialLimit = 80, sessionLimit = 600,
  shared = process.env.NODE_ENV === 'production', storeFactory = (prefix) => new MongoRateLimitStore(prefix) } = {}) {
  const options = { windowMs: 15 * 60 * 1000, standardHeaders: 'draft-8', legacyHeaders: false };
  const credentials = rateLimit({ ...options, limit: credentialLimit, ...(shared ? { store: storeFactory('credentials'), passOnStoreError: false } : {}) });
  const sessions = rateLimit({ ...options, limit: sessionLimit, ...(shared ? { store: storeFactory('sessions'), passOnStoreError: false } : {}) });
  return (req, res, next) => {
    if (shared && req.method === 'POST' && req.path === '/logout' && !isDatabaseReady()) return next();
    const sessionRequest = (req.method === 'GET' && req.path === '/me')
      || (req.method === 'POST' && req.path === '/logout');
    return (sessionRequest ? sessions : credentials)(req, res, next);
  };
}
