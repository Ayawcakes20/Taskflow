import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { ApiError } from '../middleware/errorMiddleware.js';
import { loginSchema, passwordChangeSchema, registerSchema } from '../utils/validation.js';
import { recordActivity } from '../utils/activity.js';

const COOKIE_NAME = () => process.env.SESSION_COOKIE_NAME || 'taskflow_session';
const DAY = 24 * 60 * 60 * 1000;

function tokenFor(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(503, 'Authentication is not configured. Set a JWT secret of at least 32 characters.');
  return jwt.sign({ sub: user.id, role: user.role, sessionVersion: user.sessionVersion ?? 0 }, secret, { expiresIn: '7d', issuer: 'taskflow' });
}

function cookieOptions() {
  const sameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'none').toLowerCase();
  return {
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE !== 'false',
    sameSite: ['strict', 'lax', 'none'].includes(sameSite) ? sameSite : 'none',
    path: '/',
    maxAge: 7 * DAY,
  };
}

function setSession(res, user) {
  res.cookie(COOKIE_NAME(), tokenFor(user), cookieOptions());
}

function clearSession(res) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(COOKIE_NAME(), options);
}

export async function register(req, res) {
  const values = registerSchema.parse(req.body);
  const normalizedEmail = values.email.toLowerCase();
  const normalizedUsername = values.username.toLowerCase();
  const duplicate = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] }).select('_id email username');
  if (duplicate) {
    throw new ApiError(409, duplicate.email === normalizedEmail ? 'An account with this email already exists.' : 'That username is already in use.');
  }

  const user = await User.create({ ...values, email: normalizedEmail, username: normalizedUsername });
  setSession(res, user);
  await recordActivity({ actor: user._id, action: 'user.registered', entityType: 'user', entityId: user._id, entityTitle: `${user.firstName} ${user.lastName}` });
  res.status(201).json({ success: true, data: { user: user.toJSON() } });
}

export async function login(req, res) {
  const values = loginSchema.parse(req.body);
  const identifier = values.identifier.trim().toLowerCase();
  const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] }).select('+password +sessionVersion');
  if (!user || !user.isActive || !(await user.comparePassword(values.password))) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  setSession(res, user);
  await recordActivity({ actor: user._id, action: 'user.login', entityType: 'auth', entityId: user._id, entityTitle: `${user.firstName} ${user.lastName}` });
  res.json({ success: true, data: { user: user.toJSON() } });
}

export async function currentUser(req, res) {
  res.json({ success: true, data: { user: req.user.toJSON() } });
}

export async function logout(req, res) {
  const cookieName = COOKIE_NAME();
  const token = req.cookies?.[cookieName];
  if (token && process.env.JWT_SECRET) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.sub) await recordActivity({ actor: payload.sub, action: 'user.logout', entityType: 'auth', entityId: payload.sub });
    } catch {
      // An invalid/expired cookie is still cleared; logout remains idempotent.
    }
  } else if (req.user?._id) {
    await recordActivity({ actor: req.user._id, action: 'user.logout', entityType: 'auth', entityId: req.user._id });
  }
  clearSession(res);
  res.json({ success: true, message: 'Signed out.' });
}

export async function changePassword(req, res) {
  const values = passwordChangeSchema.parse(req.body);
  const user = await User.findById(req.user._id).select('+password +sessionVersion');
  if (!user || !(await user.comparePassword(values.currentPassword))) {
    throw new ApiError(400, 'Your current password is incorrect.');
  }
  user.password = values.newPassword;
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();
  setSession(res, user);
  await recordActivity({ actor: user._id, action: 'user.password_changed', entityType: 'user', entityId: user._id });
  res.json({ success: true, message: 'Password updated successfully.' });
}
