import { connectDatabase } from '../config/db.js';

export function databaseReady(connect = connectDatabase) {
  return async (req, res, next) => {
    if (req.path === '/health' || (req.path === '/auth/logout' && req.method === 'POST')) return next();
    if (await connect()) return next();
    res.setHeader('Retry-After', '3');
    return res.status(503).json({ success: false, message: 'MongoDB is temporarily unavailable. Please try again shortly.' });
  };
}
