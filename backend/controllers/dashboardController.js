import Task from '../models/Task.js';
import ActivityLog from '../models/ActivityLog.js';
import { buildCompletionTrend, taskStatusRank } from '../utils/dashboardState.js';
import { normalizeTaskList } from '../utils/taskShape.js';
import { deadlineBoundary, completionWindow } from '../../frontend/src/utils/workspaceDates.js';

function taskScope(user) {
  return user.role === 'Admin' ? {} : { $or: [
    { createdBy: user._id },
    { assignedUsers: user._id },
    { assignedUser: user._id },
  ] };
}

function activityScope(user) {
  return user.role === 'Admin' ? {} : { $or: [{ actor: user._id }, { targetUser: user._id }] };
}

async function populateDashboardTasks(rows) {
  const populated = await Task.populate(rows, [
    { path: 'assignedUsers', select: 'firstName lastName username email profileImage' },
    { path: 'assignedUser', select: 'firstName lastName username email profileImage' },
    { path: 'createdBy', select: 'firstName lastName username' },
  ]);
  return normalizeTaskList(populated);
}

export async function getDashboard(req, res) {
  const scope = taskScope(req.user);
  const activityFilter = activityScope(req.user);
  const now = new Date();
  const today = deadlineBoundary(now);
  const nextWeek = new Date(today); nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const { start: trendStart, end: trendEnd } = completionWindow(now);
  const recentTaskPipeline = [
    { $match: scope },
    { $addFields: { __statusRank: { $switch: {
      branches: [
        { case: { $eq: ['$status', 'Pending'] }, then: taskStatusRank.Pending },
        { case: { $eq: ['$status', 'In Progress'] }, then: taskStatusRank['In Progress'] },
        { case: { $eq: ['$status', 'Completed'] }, then: taskStatusRank.Completed },
      ],
      default: 3,
    } } } },
    { $sort: { __statusRank: 1, updatedAt: -1, _id: -1 } },
    { $limit: 6 },
    { $project: { __statusRank: 0, imageUrl: 0, comments: 0 } },
  ];
  const completedCurrentFilter = {
    $and: [scope, { status: 'Completed' }, { $or: [
      { completedAt: { $gte: trendStart, $lt: trendEnd } },
      { completedAt: null, updatedAt: { $gte: trendStart, $lt: trendEnd } },
    ] }],
  };

  const [total, pending, inProgress, completed, overdue, dueSoonRows, recentRows, recentActivity, statuses, priorities, currentCompletedTasks] = await Promise.all([
    Task.countDocuments(scope),
    Task.countDocuments({ ...scope, status: 'Pending' }),
    Task.countDocuments({ ...scope, status: 'In Progress' }),
    Task.countDocuments({ ...scope, status: 'Completed' }),
    Task.countDocuments({ ...scope, status: { $ne: 'Completed' }, dueDate: { $type: 'date', $lt: today } }),
    Task.find({ ...scope, status: { $ne: 'Completed' }, dueDate: { $type: 'date', $gte: today, $lt: nextWeek } }).select('-imageUrl -comments').sort({ dueDate: 1 }).limit(5).lean(),
    Task.aggregate(recentTaskPipeline),
    ActivityLog.find(activityFilter).sort({ createdAt: -1 }).limit(6).populate('actor', 'firstName lastName profileImage').lean(),
    Task.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: scope }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Task.find(completedCurrentFilter).select('status completedAt updatedAt').lean(),
  ]);
  const [upcomingDeadlines, recentTasks] = await Promise.all([
    populateDashboardTasks(dueSoonRows),
    populateDashboardTasks(recentRows),
  ]);

  res.json({ success: true, data: {
    stats: { total, pending, inProgress, completed, overdue },
    breakdown: { status: statuses, priority: priorities },
    completionTrend: buildCompletionTrend(currentCompletedTasks, now),
    upcomingDeadlines,
    recentTasks,
    recentActivity,
  } });
}
