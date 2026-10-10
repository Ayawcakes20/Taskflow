import { isUpcomingDeadline } from './taskDates.js';
import { workspaceDayKey } from './workspaceDates.js';

const statusKeys = Object.freeze({ Pending: 'pending', 'In Progress': 'inProgress', Completed: 'completed' });
const statusRank = Object.freeze({ Pending: 0, 'In Progress': 1, Completed: 2 });
const idOf = (task) => String(task?._id ?? task?.id ?? '');

function dayKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function adjustBreakdown(items = [], previousValue, nextValue) {
  const next = items.map((item) => ({ ...item }));
  const update = (value, delta) => {
    if (!value) return;
    const current = next.find((item) => item._id === value);
    if (current) current.count = Math.max(0, (current.count || 0) + delta);
    else if (delta > 0) next.push({ _id: value, count: delta });
  };
  if (previousValue !== nextValue) {
    update(previousValue, -1);
    update(nextValue, 1);
  }
  return next.filter((item) => item.count > 0);
}

export function applyDashboardTaskUpdate(dashboard, previousTask, updatedTask, now = new Date()) {
  if (!dashboard || !updatedTask) return dashboard;
  const previous = previousTask || updatedTask;
  const oldStatus = previous.status;
  const newStatus = updatedTask.status;
  const stats = { ...(dashboard.stats || {}) };

  if (oldStatus !== newStatus) {
    const oldKey = statusKeys[oldStatus];
    const newKey = statusKeys[newStatus];
    if (oldKey) stats[oldKey] = Math.max(0, (stats[oldKey] || 0) - 1);
    if (newKey) stats[newKey] = (stats[newKey] || 0) + 1;
  }
  const today = workspaceDayKey(now);
  const isOverdue = (task) => Boolean(dayKey(task?.dueDate) && dayKey(task.dueDate) < today && task.status !== 'Completed');
  if (isOverdue(previous) !== isOverdue(updatedTask)) {
    stats.overdue = Math.max(0, (stats.overdue || 0) + (isOverdue(updatedTask) ? 1 : -1));
  }

  const upcomingById = new Map((dashboard.upcomingDeadlines || []).map((task) => [idOf(task), task]));
  upcomingById.delete(idOf(updatedTask));
  if (isUpcomingDeadline(updatedTask, now)) upcomingById.set(idOf(updatedTask), updatedTask);
  const upcomingDeadlines = [...upcomingById.values()].sort((left, right) => dayKey(left.dueDate).localeCompare(dayKey(right.dueDate))).slice(0, 5);

  const recentById = new Map((dashboard.recentTasks || []).map((task) => [idOf(task), task]));
  recentById.set(idOf(updatedTask), updatedTask);
  const recentTasks = [...recentById.values()].sort((left, right) => {
    const rank = (statusRank[left.status] ?? 3) - (statusRank[right.status] ?? 3);
    return rank || new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  }).slice(0, 6);

  const completionTrend = (dashboard.completionTrend || []).map((item) => ({ ...item }));
  if (oldStatus !== newStatus) {
    const adjustTrend = (value, delta) => {
      const key = workspaceDayKey(value);
      const day = completionTrend.find((item) => item.date === key);
      if (day) day.count = Math.max(0, (day.count || 0) + delta);
    };
    if (oldStatus === 'Completed') adjustTrend(previous.completedAt || previous.updatedAt, -1);
    if (newStatus === 'Completed') adjustTrend(updatedTask.completedAt || updatedTask.updatedAt, 1);
  }

  return {
    ...dashboard,
    stats,
    breakdown: {
      ...(dashboard.breakdown || {}),
      status: adjustBreakdown(dashboard.breakdown?.status, oldStatus, newStatus),
      priority: adjustBreakdown(dashboard.breakdown?.priority, previous.priority, updatedTask.priority),
    },
    completionTrend,
    upcomingDeadlines,
    recentTasks,
  };
}
