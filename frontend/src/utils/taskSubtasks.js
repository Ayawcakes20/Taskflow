export function subtaskProgress(subtasks = []) {
  const items = Array.isArray(subtasks) ? subtasks : [];
  const total = items.length;
  const completed = items.filter((item) => item?.completed === true).length;
  return { total, completed, percent: total ? Math.round((completed / total) * 100) : null };
}

export function statusAfterSubtaskChange(currentStatus, subtasks = []) {
  if (!Array.isArray(subtasks) || subtasks.length === 0) return currentStatus;
  const completed = subtasks.filter((item) => item.completed === true).length;
  if (completed === subtasks.length) return 'Completed';
  if (currentStatus === 'Completed' || (currentStatus === 'Pending' && completed > 0)) return 'In Progress';
  return currentStatus;
}
