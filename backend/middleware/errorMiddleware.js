export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function errorMiddleware(error, _req, res, _next) {
  let status = error.statusCode || 500;
  let message = error.message || 'Something went wrong. Please try again.';

  if (error.name === 'ZodError') {
    status = 400;
    message = error.issues?.[0]?.message || 'Please check the information and try again.';
  } else if (error.code === 11000) {
    status = 409;
    const field = Object.keys(error.keyPattern || {})[0];
    message = field === 'email' ? 'An account with this email already exists.' : 'That username is already in use.';
  } else if (error.name === 'CastError') {
    status = 404;
    message = 'The requested item could not be found.';
  } else if (error.name === 'ValidationError') {
    status = 400;
    message = Object.values(error.errors || {})[0]?.message || 'Please check the information and try again.';
  } else if (status >= 500) {
    message = 'Something went wrong. Please try again in a moment.';
    console.error(error);
  }

  res.status(status).json({
    success: false,
    message,
    ...(error.details ? { details: error.details } : {}),
  });
}

export function notFoundMiddleware(_req, res) {
  res.status(404).json({ success: false, message: 'That page or resource could not be found.' });
}
