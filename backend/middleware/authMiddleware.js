import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError } from './errorMiddleware.js';

function getToken(req) {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'taskflow_session';
  const cookie = req.cookies?.[cookieName];
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  return cookie || bearer;
}

export async function protect(req, _res, next) {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Please sign in to continue.');
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new ApiError(503, 'Authentication is not configured on this server.');

    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.sub).select('-password +sessionVersion');
    if (!user || !user.isActive) throw new ApiError(401, 'This account is unavailable. Please contact an administrator.');
    if ((payload.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) {
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Your session has expired. Please sign in again.'));
      return;
    }
    next(error);
  }
}
