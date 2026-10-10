import Notification from '../models/Notification.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { deadlineBoundary } from '../../frontend/src/utils/workspaceDates.js';

const preferenceForType = {
  assigned: 'assignments',
  updated: 'updates',
  completed: 'updates',
  comment: 'updates',
  mention: 'mentions',
  approaching_deadline: 'deadlines',
  overdue: 'deadlines',
};

export async function notifyUser({ user, task = null, type, title, message, dedupeKey = null }) {
  if (!user) return null;
  const preference = preferenceForType[type];
  if (preference) {
    const recipient = await User.findById(user).select('preferences.notifications isActive').lean();
    if (!recipient?.isActive || recipient.preferences?.notifications?.[preference] === false) return null;
  }
  try {
    if (dedupeKey) {
      return await Notification.findOneAndUpdate(
        { dedupeKey },
        { $setOnInsert: { user, task, type, title, message, dedupeKey } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    return await Notification.create({ user, task, type, title, message });
  } catch (error) {
    if (error.code !== 11000) console.error(`Notification could not be saved: ${error.message}`);
    return null;
  }
}

export async function syncDeadlineNotifications(userId) {
  const now = new Date();
  const today = deadlineBoundary(now);
  const horizon = new Date(today.getTime() + 2 * 86400000);
  const tasks = await Task.find({
    $and: [
      { status: { $ne: 'Completed' } },
      { dueDate: { $type: 'date', $lte: horizon } },
      { $or: [{ assignedUsers: userId }, { assignedUser: userId }, { createdBy: userId }] },
    ],
  }).select('_id title dueDate status assignedUsers assignedUser createdBy').sort({ dueDate: 1 }).limit(80).lean();

  for (const task of tasks) {
    const overdue = new Date(task.dueDate) < today;
    const type = overdue ? 'overdue' : 'approaching_deadline';
    await notifyUser({
      user: userId,
      task: task._id,
      type,
      title: overdue ? 'Task overdue' : 'Deadline approaching',
      message: overdue ? `${task.title} is past its due date.` : `${task.title} is due within the next two days.`,
      dedupeKey: `${userId}:${task._id}:${type}:${new Date(task.dueDate).toISOString().slice(0, 10)}`,
    });
  }
}
