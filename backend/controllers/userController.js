import User from '../models/User.js';
import Task from '../models/Task.js';
import ActivityLog from '../models/ActivityLog.js';
import { ApiError } from '../middleware/errorMiddleware.js';
import { preferencesSchema, profileSchema } from '../utils/validation.js';
import { paginationFrom, escapeRegex } from '../utils/query.js';
import { recordActivity } from '../utils/activity.js';
import { validateProfileImage } from '../utils/taskImages.js';

export async function listAssignees(_req, res) {
  const users = await User.find({ isActive: true }).select('firstName lastName username email profileImage').sort({ firstName: 1, lastName: 1 }).limit(250).lean();
  res.json({ success: true, data: { items: users } });
}

export async function listUsers(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const filter = {};
  if (req.query.q) {
    const pattern = new RegExp(escapeRegex(req.query.q.trim()), 'i');
    filter.$or = [{ firstName: pattern }, { lastName: pattern }, { username: pattern }, { email: pattern }];
  }
  if (['User', 'Admin'].includes(req.query.role)) filter.role = req.query.role;
  if (req.query.isActive === 'true' || req.query.isActive === 'false') filter.isActive = req.query.isActive === 'true';
  const [items, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } } });
}

export async function getUser(req, res) {
  if (req.params.id !== String(req.user._id) && req.user.role !== 'Admin') {
    throw new ApiError(403, 'You do not have permission to view this profile.');
  }
  const user = await User.findById(req.params.id).select('-password').lean();
  if (!user) throw new ApiError(404, 'User not found.');
  const [created, assigned, activity] = await Promise.all([
    Task.countDocuments({ createdBy: user._id }),
    Task.countDocuments({ $or: [{ assignedUsers: user._id }, { assignedUser: user._id }] }),
    ActivityLog.find({ $or: [{ actor: user._id }, { targetUser: user._id }] }).sort({ createdAt: -1 }).limit(8).populate('actor', 'firstName lastName').lean(),
  ]);
  res.json({ success: true, data: { user, summary: { createdTasks: created, assignedTasks: assigned }, activity } });
}

export async function updateUser(req, res) {
  const isSelf = req.params.id === String(req.user._id);
  const isAdmin = req.user.role === 'Admin';
  if (!isSelf && !isAdmin) throw new ApiError(403, 'You do not have permission to update this user.');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  const profileFields = ['firstName', 'lastName', 'username', 'email', 'profileImage'];
  if (profileFields.some((field) => Object.hasOwn(req.body, field))) {
    const values = profileSchema.partial().parse(Object.fromEntries(profileFields.filter((key) => Object.hasOwn(req.body, key)).map((key) => [key, req.body[key]])));
    for (const [key, value] of Object.entries(values)) {
      user[key] = key === 'profileImage'
        ? validateProfileImage(value)
        : key === 'username' || key === 'email' ? value.toLowerCase() : value;
    }
  }

  if (!isSelf && isAdmin) {
    if (Object.hasOwn(req.body, 'role')) {
      if (!['User', 'Admin'].includes(req.body.role)) throw new ApiError(400, 'Choose a valid role.');
      if (user._id.equals(req.user._id) && req.body.role !== 'Admin') throw new ApiError(400, 'You cannot remove your own Admin role.');
      user.role = req.body.role;
    }
    if (Object.hasOwn(req.body, 'isActive')) {
      if (typeof req.body.isActive !== 'boolean') throw new ApiError(400, 'Choose a valid account status.');
      if (user._id.equals(req.user._id) && req.body.isActive === false) throw new ApiError(400, 'You cannot disable your own account.');
      user.isActive = req.body.isActive;
    }
  } else if (Object.hasOwn(req.body, 'role') || Object.hasOwn(req.body, 'isActive')) {
    throw new ApiError(403, 'You cannot change your role or account status.');
  }

  await user.save();
  await recordActivity({ actor: req.user._id, action: 'user.updated', entityType: 'user', entityId: user._id, entityTitle: `${user.firstName} ${user.lastName}`, details: isSelf ? 'Profile updated' : 'Account details changed', targetUser: isSelf ? null : user._id });
  res.json({ success: true, data: { user: user.toJSON() } });
}

export async function updatePreferences(req, res) {
  const values = preferencesSchema.parse(req.body);
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (values.theme) user.preferences.theme = values.theme;
  if (values.notifications) user.preferences.notifications = { ...user.preferences.notifications.toObject?.(), ...values.notifications };
  await user.save();
  res.json({ success: true, data: { preferences: user.preferences } });
}

export async function deleteUser(req, res) {
  if (req.params.id === String(req.user._id)) throw new ApiError(400, 'You cannot delete your own account.');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  await User.deleteOne({ _id: user._id });
  await recordActivity({ actor: req.user._id, action: 'user.deleted', entityType: 'user', entityId: user._id, entityTitle: `${user.firstName} ${user.lastName}`, targetUser: user._id });
  res.json({ success: true, message: 'User deleted successfully.' });
}
