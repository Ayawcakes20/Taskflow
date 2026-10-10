export function normalizeSubtasks(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...(item?._id ? { _id: String(item._id) } : {}),
    title: String(item?.title ?? '').trim(),
    completed: item?.completed === true,
  }));
}

export function subtasksChanged(previous = [], next = []) {
  const before = normalizeSubtasks(previous);
  const after = normalizeSubtasks(next);
  if (before.length !== after.length) return true;
  return before.some((item, index) => item.title !== after[index].title
    || item.completed !== after[index].completed
    || Boolean(item._id) !== Boolean(after[index]._id)
    || (item._id && item._id !== after[index]._id));
}

export function statusAfterSubtaskChange(currentStatus, subtasks = []) {
  if (!Array.isArray(subtasks) || subtasks.length === 0) return currentStatus;
  const completed = subtasks.filter((item) => item.completed === true).length;
  if (completed === subtasks.length) return 'Completed';
  if (currentStatus === 'Completed' || (currentStatus === 'Pending' && completed > 0)) return 'In Progress';
  return currentStatus;
}

export function subtaskProgress(subtasks = []) {
  const total = Array.isArray(subtasks) ? subtasks.length : 0;
  if (!total) return { total: 0, completed: 0, percent: null };
  const completed = subtasks.filter((item) => item.completed === true).length;
  return { total, completed, percent: Math.round((completed / total) * 100) };
}
