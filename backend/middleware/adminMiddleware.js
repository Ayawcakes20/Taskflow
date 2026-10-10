import { ApiError } from './errorMiddleware.js';

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'Admin') {
    return next(new ApiError(403, 'You do not have permission to access this area.'));
  }
  return next();
}
