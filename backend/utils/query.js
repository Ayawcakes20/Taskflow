export const SORT_FIELDS = Object.freeze({
  dueDate: 'dueDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  priority: 'priority',
  status: 'status',
  title: 'title',
});

export function paginationFrom(query) {
  const requestedPage = Number.parseInt(query.page, 10);
  const requestedLimit = Number.parseInt(query.limit, 10);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const limit = Number.isSafeInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 10;
  return { page, limit, skip: (page - 1) * limit };
}

export function sortFrom(query) {
  const key = Object.hasOwn(SORT_FIELDS, query.sortBy) ? query.sortBy : 'dueDate';
  const field = SORT_FIELDS[key];
  const direction = query.order === 'asc' ? 1 : -1;
  return { [field]: direction, _id: -1 };
}

export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
