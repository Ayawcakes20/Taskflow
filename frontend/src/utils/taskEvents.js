export const TASK_CHANGED_EVENT = 'taskflow:task-changed';

export function dispatchTaskChanged(task, meta = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TASK_CHANGED_EVENT, { detail: { task, ...meta } }));
}
