import { rateLimit } from 'express-rate-limit';

export function createAuthRateLimits({ credentialLimit = 80, sessionLimit = 600 } = {}) {
  const options = { windowMs: 15 * 60 * 1000, standardHeaders: 'draft-8', legacyHeaders: false };
  const credentials = rateLimit({ ...options, limit: credentialLimit });
  const sessions = rateLimit({ ...options, limit: sessionLimit });
  return (req, res, next) => {
    const sessionRequest = (req.method === 'GET' && req.path === '/me')
      || (req.method === 'POST' && req.path === '/logout');
    return (sessionRequest ? sessions : credentials)(req, res, next);
  };
}
