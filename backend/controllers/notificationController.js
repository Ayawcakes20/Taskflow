import Notification from '../models/Notification.js';
import { paginationFrom } from '../utils/query.js';
import { ApiError } from '../middleware/errorMiddleware.js';
import { syncDeadlineNotifications } from '../utils/notifications.js';

export async function listNotifications(req, res) {
  await syncDeadlineNotifications(req.user._id);
  const { page, limit, skip } = paginationFrom(req.query);
  const filter = { user: req.user._id };
  if (req.query.read === 'true') filter.isRead = true;
  if (req.query.read === 'false') filter.isRead = false;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('task', 'title status dueDate').lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  res.json({ success: true, data: { items, unread, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } } });
}

export async function markNotificationRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true },
  ).lean();
  if (!notification) throw new ApiError(404, 'Notification not found.');
  res.json({ success: true, data: { notification } });
}

export async function markAllNotificationsRead(req, res) {
  const result = await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  res.json({ success: true, data: { modified: result.modifiedCount } });
}
