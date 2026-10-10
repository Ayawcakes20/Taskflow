function userId(value) {
  if (!value) return '';
  return String(value._id ?? value);
}

export function normalizeTaskShape(task) {
  if (!task) return task;
  const value = typeof task.toObject === 'function' ? task.toObject() : { ...task };
  const candidates = [
    ...(Array.isArray(value.assignedUsers) ? value.assignedUsers : []),
    value.assignedUser,
  ];
  const seen = new Set();
  const assignedUsers = candidates.filter((person) => {
    const id = userId(person);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return {
    ...value,
    assignedUsers,
    assignedUser: assignedUsers[0] || null,
    subtasks: Array.isArray(value.subtasks) ? value.subtasks : [],
    comments: Array.isArray(value.comments) ? value.comments : [],
  };
}

export function normalizeTaskList(tasks = []) {
  return tasks.map(normalizeTaskShape);
}
