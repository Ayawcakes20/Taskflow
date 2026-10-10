import Task from '../models/Task.js';
import { buildCompletionTrend } from '../utils/dashboardState.js';
import { deadlineBoundary, completionWindow } from '../../frontend/src/utils/workspaceDates.js';

function taskScope(user) {
  return user.role === 'Admin' ? {} : { $or: [{ createdBy: user._id }, { assignedUsers: user._id }, { assignedUser: user._id }] };
}

export async function getReports(req, res) {
  const scope = taskScope(req.user);
  const now = new Date();
  const today = deadlineBoundary(now);
  const { start, end } = completionWindow(now, 30);
  const [total, completed, overdue, byStatus, byPriority, byCategory, tasks] = await Promise.all([
    Task.countDocuments(scope),
    Task.countDocuments({ ...scope, status: 'Completed' }),
    Task.countDocuments({ ...scope, status: { $ne: 'Completed' }, dueDate: { $type: 'date', $lt: today } }),
    Task.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Task.aggregate([{ $match: scope }, { $group: { _id: '$priority', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Task.aggregate([{ $match: scope }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    Task.find({ $and: [scope, { status: 'Completed' }, { $or: [
      { completedAt: { $gte: start, $lt: end } },
      { completedAt: null, updatedAt: { $gte: start, $lt: end } },
    ] }] }).select('status completedAt updatedAt').lean(),
  ]);
  const trend = buildCompletionTrend(tasks, now, 30).map(({ date, count }) => ({ date, count }));
  res.json({ success: true, data: {
    summary: { total, completed, overdue, completionRate: total ? Math.round((completed / total) * 100) : 0 },
    byStatus, byPriority, byCategory, trend,
  } });
}
