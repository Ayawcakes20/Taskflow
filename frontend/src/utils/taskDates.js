import { workspaceDayKey, isValidCalendarDate } from './workspaceDates.js';

export function hasValidDueDate(task) {
  if (task?.dueDate === null || task?.dueDate === undefined || task?.dueDate === '') return false;
  const date = new Date(task.dueDate);
  return Number.isFinite(date.getTime()) && (typeof task.dueDate !== 'string' || isValidCalendarDate(task.dueDate.slice(0, 10)));
}

function dateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (!hasValidDueDate({ dueDate: value })) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export function isUpcomingDeadline(task, now = new Date()) {
  if (!hasValidDueDate(task) || task.status === 'Completed') return false;
  const due = dateKey(task.dueDate);
  const today = workspaceDayKey(now);
  const end = new Date(`${today}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  return due >= today && due < end.toISOString().slice(0, 10);
}
