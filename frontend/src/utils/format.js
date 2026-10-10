import { workspaceDayKey } from './workspaceDates.js';

function pad(number) { return String(number).padStart(2, '0'); }

export function dateOnlyKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isDueDateOverdue(value, now = new Date()) {
  const key = dateOnlyKey(value);
  return Boolean(key && key < workspaceDayKey(now));
}

export function formatDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return 'No date set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date set';
  return new Intl.DateTimeFormat('en', options).format(date);
}

export function formatDueDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const key = dateOnlyKey(value);
  if (!key) return 'No due date';
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(date);
}

export function relativeDate(value, now = new Date()) {
  const key = dateOnlyKey(value);
  if (!key) return 'No due date';
  const [year, month, day] = key.split('-').map(Number);
  const due = Date.UTC(year, month - 1, day);
  const start = new Date(`${workspaceDayKey(now)}T00:00:00.000Z`).getTime();
  const days = Math.round((due - start) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  return formatDueDate(key, { month: 'short', day: 'numeric' });
}

export function initials(user) {
  return `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || '?';
}

export function safeMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback || 'Something went wrong.';
}
