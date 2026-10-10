export const WORKSPACE_TIME_ZONE = 'Asia/Manila';

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: WORKSPACE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export function workspaceDayKey(value = new Date()) {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(dayFormatter.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isValidCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Due dates are calendar labels stored at UTC midnight, not instants in Manila.
export function deadlineBoundary(now = new Date(), offsetDays = 0) {
  const date = new Date(`${workspaceDayKey(now)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

// Completion timestamps are instants; the window starts at Manila midnight.
export function completionWindow(now = new Date(), days = 7) {
  return {
    start: new Date(`${deadlineBoundary(now, 1 - days).toISOString().slice(0, 10)}T00:00:00+08:00`),
    end: new Date(`${deadlineBoundary(now, 1).toISOString().slice(0, 10)}T00:00:00+08:00`),
  };
}
