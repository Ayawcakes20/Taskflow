import { deadlineBoundary, workspaceDayKey } from '../../frontend/src/utils/workspaceDates.js';

export function buildCompletionTrend(tasks = [], now = new Date(), length = 7) {
  const today = deadlineBoundary(now);
  const days = Array.from({ length }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - length + 1 + index);
    return { date: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' }), count: 0 };
  });
  const byDay = new Map(days.map((day) => [day.date, day]));

  for (const task of tasks) {
    if (task?.status !== 'Completed') continue;
    const key = workspaceDayKey(task.completedAt || task.updatedAt);
    const day = key && byDay.get(key);
    if (day) day.count += 1;
  }
  return days;
}

export const taskStatusRank = Object.freeze({ Pending: 0, 'In Progress': 1, Completed: 2 });

export function sortRecentTasks(tasks = []) {
  return [...tasks].sort((left, right) => {
    const rankDifference = (taskStatusRank[left.status] ?? 3) - (taskStatusRank[right.status] ?? 3);
    if (rankDifference) return rankDifference;
    return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  });
}
