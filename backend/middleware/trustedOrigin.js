import { ApiError } from './errorMiddleware.js';

export function trustedOrigin(origins, production = process.env.NODE_ENV === 'production') {
  return (req, _res, next) => {
    const origin = req.headers.origin;
    if (origin && !origins.has(origin)) return next(new ApiError(403, 'Origin not allowed.'));
    // Browsers send Origin for JSON mutations, including through the frontend rewrite.
    // Reject origin-less cookie mutations in production; bearer API clients remain supported.
    if (production && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !origin
        && Object.keys(req.cookies || {}).length && !req.headers.authorization?.startsWith('Bearer ')) {
      return next(new ApiError(403, 'A trusted origin is required.'));
    }
    next();
  };
}
