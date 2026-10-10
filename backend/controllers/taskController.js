import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { ApiError } from '../middleware/errorMiddleware.js';
import { taskBulkSchema, taskCommentSchema, taskSchema, taskUpdateSchema } from '../utils/validation.js';
import { paginationFrom, sortFrom, escapeRegex } from '../utils/query.js';
import { recordActivity } from '../utils/activity.js';
import { notifyUser } from '../utils/notifications.js';
import { normalizeTaskList, normalizeTaskShape } from '../utils/taskShape.js';
import { validateTaskImages } from '../utils/taskImages.js';
import { normalizeSubtasks, statusAfterSubtaskChange, subtasksChanged } from '../utils/taskSubtasks.js';
import { deadlineBoundary } from '../../frontend/src/utils/workspaceDates.js';

function visibleTo(user) {
  return user.role === 'Admin' ? {} : { $or: [
    { createdBy: user._id },
    { assignedUsers: user._id },
    { assignedUser: user._id },
  ] };
}

function buildFilter(user, query, matchingAssignees = []) {
  const filter = visibleTo(user);
  const and = filter.$or ? [filter] : [];
  if (query.q?.trim()) {
    const search = new RegExp(escapeRegex(query.q.trim().slice(0, 100)), 'i');
    const alternatives = [{ title: search }, { description: search }, { category: search }];
    if (matchingAssignees.length) alternatives.push({ $or: [
      { assignedUsers: { $in: matchingAssignees } },
      { assignedUser: { $in: matchingAssignees } },
    ] });
    and.push({ $or: alternatives });
  }
  if (['Pending', 'In Progress', 'Completed'].includes(query.status)) and.push({ status: query.status });
  if (['Low', 'Medium', 'High'].includes(query.priority)) and.push({ priority: query.priority });
  if (query.category) and.push({ category: new RegExp(`^${escapeRegex(query.category.trim())}$`, 'i') });
  if (query.assignedUser) {
    if (mongoose.isValidObjectId(query.assignedUser)) {
      const id = new mongoose.Types.ObjectId(query.assignedUser);
      and.push({ $or: [{ assignedUsers: id }, { assignedUser: id }] });
    } else and.push({ _id: null });
  }
  const today = deadlineBoundary();
  if (query.dueDate === 'overdue') and.push({ dueDate: { $lt: today }, status: { $ne: 'Completed' } });
  if (query.dueDate === 'today') {
    const end = new Date(today); end.setUTCDate(end.getUTCDate() + 1);
    and.push({ dueDate: { $gte: today, $lt: end } });
  }
  if (query.dueDate === 'week') {
    const end = new Date(today); end.setUTCDate(end.getUTCDate() + 7);
    and.push({ dueDate: { $gte: today, $lt: end } });
  }
  if (query.dueDate === 'none') and.push({ dueDate: null });
  if (query.dueFrom || query.dueTo) {
    const range = {};
    if (query.dueFrom && !Number.isNaN(Date.parse(query.dueFrom))) range.$gte = new Date(query.dueFrom);
    if (query.dueTo && !Number.isNaN(Date.parse(query.dueTo))) {
      const end = new Date(query.dueTo); end.setUTCHours(23, 59, 59, 999); range.$lte = end;
    }
    if (Object.keys(range).length) and.push({ dueDate: range });
  }
  return and.length ? { $and: and } : filter;
}

async function validateAssignees(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean).map(String))];
  if (uniqueIds.some((id) => !mongoose.isValidObjectId(id))) throw new ApiError(400, 'Choose valid assignees.');
  if (!uniqueIds.length) return [];
  const users = await User.find({ _id: { $in: uniqueIds }, isActive: true }).select('_id firstName lastName username email profileImage').lean();
  const byId = new Map(users.map((person) => [String(person._id), person]));
  if (byId.size !== uniqueIds.length) throw new ApiError(400, 'One or more selected users are unavailable.');
  return uniqueIds.map((id) => byId.get(id));
}

function populateTask(query, { includeComments = false } = {}) {
  const populated = query
    .populate('assignedUsers', 'firstName lastName username email profileImage')
    .populate('assignedUser', 'firstName lastName username email profileImage')
    .populate('createdBy', 'firstName lastName username');
  return includeComments
    ? populated.populate('comments.user', 'firstName lastName username profileImage').populate('comments.mentions', 'firstName lastName username profileImage')
    : populated.select('-comments');
}

async function listSortedTasks(filter, query, skip, limit) {
  if (query.sortBy !== 'priority') {
    const rows = await populateTask(Task.find(filter).select('-imageUrl -comments').sort(sortFrom(query)).skip(skip).limit(limit)).lean();
    return normalizeTaskList(rows);
  }
  const direction = query.order === 'asc' ? 1 : -1;
  const rows = await Task.aggregate([
    { $match: filter },
    { $addFields: { __priorityRank: { $switch: {
      branches: [
        { case: { $eq: ['$priority', 'Low'] }, then: 1 },
        { case: { $eq: ['$priority', 'Medium'] }, then: 2 },
        { case: { $eq: ['$priority', 'High'] }, then: 3 },
      ],
      default: 0,
    } } } },
    { $sort: { __priorityRank: direction, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { __priorityRank: 0, imageUrl: 0, comments: 0 } },
  ]);
  const populated = await Task.populate(rows, [
    { path: 'assignedUsers', select: 'firstName lastName username email profileImage' },
    { path: 'assignedUser', select: 'firstName lastName username email profileImage' },
    { path: 'createdBy', select: 'firstName lastName username' },
  ]);
  return normalizeTaskList(populated);
}

export async function listTasks(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  let matchingAssignees = [];
  if (req.query.q?.trim()) {
    const search = new RegExp(escapeRegex(req.query.q.trim().slice(0, 100)), 'i');
    matchingAssignees = (await User.find({ isActive: true, $or: [{ firstName: search }, { lastName: search }, { username: search }, { email: search }] }).select('_id').limit(250).lean()).map((person) => person._id);
  }
  const filter = buildFilter(req.user, req.query, matchingAssignees);
  const [items, total, categories] = await Promise.all([
    listSortedTasks(filter, req.query, skip, limit),
    Task.countDocuments(filter),
    Task.distinct('category', visibleTo(req.user)),
  ]);
  res.json({ success: true, data: { items, categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b)), pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } } });
}

export async function getTask(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Task not found.');
  const rawTask = await populateTask(Task.findOne({ _id: req.params.id, ...visibleTo(req.user) }), { includeComments: true }).lean();
  if (!rawTask) throw new ApiError(404, 'Task not found.');
  const task = normalizeTaskShape(rawTask);
  const activity = await ActivityLog.find({ entityType: 'task', entityId: task._id }).sort({ createdAt: -1 }).populate('actor', 'firstName lastName profileImage').lean();
  res.json({ success: true, data: { task, activity } });
}

export async function createTask(req, res) {
  const values = taskSchema.parse(req.body);
  const requestedIds = Object.hasOwn(values, 'assignedUsers') ? values.assignedUsers || [] : values.assignedUser ? [values.assignedUser] : [];
  const assignees = await validateAssignees(requestedIds);
  const images = validateTaskImages(values);
  const task = await Task.create({
    ...values,
    assignedUsers: assignees.map((person) => person._id),
    assignedUser: assignees[0]?._id || null,
    createdBy: req.user._id,
    dueDate: values.dueDate ? new Date(values.dueDate) : null,
    completedAt: values.status === 'Completed' ? new Date() : null,
    ...images,
  });
  await recordActivity({ actor: req.user._id, action: 'task.created', entityType: 'task', entityId: task._id, entityTitle: task.title, details: 'Task created' });
  for (const assignee of assignees) {
    if (String(assignee._id) === String(req.user._id)) continue;
    await notifyUser({ user: assignee._id, task: task._id, type: 'assigned', title: 'Task assigned', message: `${req.user.firstName} assigned you ${task.title}.` });
    await recordActivity({ actor: req.user._id, action: 'task.assigned', entityType: 'task', entityId: task._id, entityTitle: task.title, details: `Assigned to ${assignee.firstName} ${assignee.lastName}`, targetUser: assignee._id });
  }
  const result = normalizeTaskShape(await populateTask(Task.findById(task._id)).lean());
  res.status(201).json({ success: true, data: { task: result } });
}

export async function updateTask(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Task not found.');
  const task = await Task.findOne({ _id: req.params.id, ...visibleTo(req.user) });
  if (!task) throw new ApiError(404, 'Task not found.');
  const values = taskUpdateSchema.parse(req.body);
  const previousStatus = task.status;
  const previousAssigneeIds = normalizeTaskShape(task).assignedUsers.map((person) => String(person._id ?? person));
  const nextSubtasks = Object.hasOwn(values, 'subtasks') ? normalizeSubtasks(values.subtasks) : null;
  const didSubtasksChange = nextSubtasks ? subtasksChanged(task.subtasks, nextSubtasks) : false;
  const synchronizedStatus = didSubtasksChange ? statusAfterSubtaskChange(previousStatus, nextSubtasks) : previousStatus;
  if (didSubtasksChange) {
    task.subtasks = nextSubtasks.map(({ _id, ...item }) => (_id ? { _id, ...item } : item));
  }
  const hasAssigneeUpdate = Object.hasOwn(values, 'assignedUsers') || Object.hasOwn(values, 'assignedUser');
  let nextAssignees = previousAssigneeIds;
  if (hasAssigneeUpdate) {
    const requestedIds = Object.hasOwn(values, 'assignedUsers') ? values.assignedUsers || [] : values.assignedUser ? [values.assignedUser] : [];
    const people = await validateAssignees(requestedIds);
    nextAssignees = people.map((person) => String(person._id));
    task.assignedUsers = people.map((person) => person._id);
    task.assignedUser = people[0]?._id || null;
  }
  if (Object.hasOwn(values, 'imageUrl') || Object.hasOwn(values, 'imageThumbnail')) {
    const images = validateTaskImages({
      imageUrl: Object.hasOwn(values, 'imageUrl') ? values.imageUrl : task.imageUrl,
      imageThumbnail: Object.hasOwn(values, 'imageThumbnail') ? values.imageThumbnail : task.imageThumbnail,
    });
    task.imageUrl = images.imageUrl;
    task.imageThumbnail = images.imageThumbnail;
  }
  for (const [key, value] of Object.entries(values)) {
    if (key === 'assignedUsers' || key === 'assignedUser' || key === 'imageUrl' || key === 'imageThumbnail' || key === 'subtasks') continue;
    if (key === 'dueDate') task.dueDate = value ? new Date(value) : null;
    else task[key] = value;
  }
  if (didSubtasksChange) task.status = synchronizedStatus;
  if (task.status !== previousStatus) task.completedAt = task.status === 'Completed' ? new Date() : null;
  await task.save();
  await recordActivity({ actor: req.user._id, action: 'task.updated', entityType: 'task', entityId: task._id, entityTitle: task.title, details: 'Task details updated' });

  const nextAssigneeIds = nextAssignees;
  const addedIds = nextAssigneeIds.filter((id) => !previousAssigneeIds.includes(id));
  const removedIds = previousAssigneeIds.filter((id) => !nextAssigneeIds.includes(id));
  for (const id of addedIds) {
    if (id === String(req.user._id)) continue;
    await notifyUser({ user: id, task: task._id, type: 'assigned', title: 'Task assigned', message: `${req.user.firstName} assigned you ${task.title}.` });
    await recordActivity({ actor: req.user._id, action: 'task.assigned', entityType: 'task', entityId: task._id, entityTitle: task.title, details: 'Added as an assignee', targetUser: id });
  }
  if (previousStatus !== task.status) {
    if (task.status === 'Completed') {
      await recordActivity({ actor: req.user._id, action: 'task.completed', entityType: 'task', entityId: task._id, entityTitle: task.title, details: 'Marked complete' });
    } else {
      await recordActivity({ actor: req.user._id, action: 'task.status_changed', entityType: 'task', entityId: task._id, entityTitle: task.title, details: `${previousStatus} → ${task.status}` });
    }
    const recipients = new Set([String(task.createdBy), ...previousAssigneeIds, ...nextAssigneeIds].filter((id) => id && id !== String(req.user._id)));
    const completed = task.status === 'Completed';
    for (const recipient of recipients) {
      await notifyUser({ user: recipient, task: task._id, type: completed ? 'completed' : 'updated', title: completed ? 'Task completed' : 'Task status updated', message: completed ? `${req.user.firstName} completed ${task.title}.` : `${req.user.firstName} changed ${task.title} to ${task.status}.` });
    }
  } else if (Object.keys(values).some((key) => !['assignedUsers', 'assignedUser'].includes(key)) || removedIds.length) {
    const recipients = new Set([String(task.createdBy), ...previousAssigneeIds, ...nextAssigneeIds].filter((id) => id && id !== String(req.user._id) && !addedIds.includes(id)));
    for (const recipient of recipients) await notifyUser({ user: recipient, task: task._id, type: 'updated', title: 'Task updated', message: `${req.user.firstName} updated ${task.title}.` });
  }
  const result = normalizeTaskShape(await populateTask(Task.findById(task._id)).lean());
  res.json({ success: true, data: { task: result } });
}

export async function deleteTask(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Task not found.');
  const task = await Task.findOne({ _id: req.params.id, ...visibleTo(req.user) });
  if (!task) throw new ApiError(404, 'Task not found.');
  await Task.deleteOne({ _id: task._id });
  await recordActivity({ actor: req.user._id, action: 'task.deleted', entityType: 'task', entityId: task._id, entityTitle: task.title, details: 'Task deleted' });
  res.json({ success: true, message: 'Task deleted successfully.' });
}

async function notifyCommentParticipants(task, author) {
  const assigned = normalizeTaskShape(task).assignedUsers.map((person) => String(person?._id ?? person));
  const recipients = new Set([String(task.createdBy?._id ?? task.createdBy), ...assigned]);
  for (const recipient of recipients) {
    if (!recipient || recipient === String(author._id)) continue;
    await notifyUser({
      user: recipient,
      task: task._id,
      type: 'comment',
      title: 'New task comment',
      message: `${author.firstName} commented on ${task.title}.`,
    });
  }
}

async function resolveCommentMentions(content, task) {
  const tokens = [...new Set([...content.matchAll(/(^|\s)@([a-zA-Z0-9_.-]{3,30})\b/g)].map((match) => match[2].toLowerCase()))];
  if (!tokens.length) return [];
  const participantIds = [...new Set([task.createdBy, task.assignedUser, ...(task.assignedUsers || [])].filter(Boolean).map((person) => String(person._id ?? person)))];
  const scope = { isActive: true, $or: [{ role: 'Admin' }, { _id: { $in: participantIds } }] };
  if (!tokens.includes('everyone')) scope.username = { $in: tokens };
  return User.find(scope).select('_id username firstName lastName').lean();
}

async function notifyCommentMentions(task, author, mentionedUsers) {
  for (const mentioned of mentionedUsers) {
    if (String(mentioned._id) === String(author._id)) continue;
    await notifyUser({
      user: mentioned._id,
      task: task._id,
      type: 'mention',
      title: 'You were mentioned',
      message: `${author.firstName} mentioned you in a comment on ${task.title}.`,
    });
  }
}

export async function addTaskComment(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Task not found.');
  const task = await Task.findOne({ _id: req.params.id, ...visibleTo(req.user) });
  if (!task) throw new ApiError(404, 'Task not found.');
  if (task.comments.length >= 500) throw new ApiError(409, 'This task has reached its comment limit.');
  const { content } = taskCommentSchema.parse(req.body);
  const mentionedUsers = await resolveCommentMentions(content, task);
  const comment = task.comments.create({ user: req.user._id, content, mentions: mentionedUsers.map((person) => person._id) });
  task.comments.push(comment);
  await task.save();
  await notifyCommentParticipants(task, req.user);
  await notifyCommentMentions(task, req.user, mentionedUsers);
  await recordActivity({ actor: req.user._id, action: 'task.comment_added', entityType: 'task', entityId: task._id, entityTitle: task.title, details: 'Added a task comment' });
  const populated = await Task.findById(task._id).populate('comments.user', 'firstName lastName username profileImage').populate('comments.mentions', 'firstName lastName username profileImage').lean();
  const savedComment = populated.comments.find((item) => String(item._id) === String(comment._id));
  res.status(201).json({ success: true, data: { comment: savedComment } });
}

export async function updateTaskComment(req, res) {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.commentId)) throw new ApiError(404, 'Comment not found.');
  const task = await Task.findOne({ _id: req.params.id, ...visibleTo(req.user) });
  const comment = task?.comments.id(req.params.commentId);
  if (!task || !comment) throw new ApiError(404, 'Comment not found.');
  if (String(comment.user) !== String(req.user._id) && req.user.role !== 'Admin') throw new ApiError(403, 'You can only edit your own comments.');
  const { content } = taskCommentSchema.parse(req.body);
  const mentionedUsers = await resolveCommentMentions(content, task);
  comment.content = content;
  comment.mentions = mentionedUsers.map((person) => person._id);
  await task.save();
  await notifyCommentMentions(task, req.user, mentionedUsers);
  await recordActivity({ actor: req.user._id, action: 'task.comment_updated', entityType: 'task', entityId: task._id, entityTitle: task.title, details: 'Updated a task comment' });
  const populated = await Task.findById(task._id).populate('comments.user', 'firstName lastName username profileImage').populate('comments.mentions', 'firstName lastName username profileImage').lean();
  res.json({ success: true, data: { comment: populated.comments.find((item) => String(item._id) === String(comment._id)) } });
}

export async function deleteTaskComment(req, res) {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.commentId)) throw new ApiError(404, 'Comment not found.');
  const task = await Task.findOne({ _id: req.params.id, ...visibleTo(req.user) });
  const comment = task?.comments.id(req.params.commentId);
  if (!task || !comment) throw new ApiError(404, 'Comment not found.');
  if (String(comment.user) !== String(req.user._id) && req.user.role !== 'Admin') throw new ApiError(403, 'You can only delete your own comments.');
  comment.deleteOne();
  await task.save();
  await recordActivity({ actor: req.user._id, action: 'task.comment_deleted', entityType: 'task', entityId: task._id, entityTitle: task.title, details: 'Deleted a task comment' });
  res.json({ success: true, data: { deletedId: req.params.commentId } });
}

export async function bulkTasks(req, res) {
  const values = taskBulkSchema.parse(req.body);
  const taskIds = values.taskIds.map((id) => new mongoose.Types.ObjectId(id));
  const scope = { _id: { $in: taskIds }, ...visibleTo(req.user) };
  const documents = await Task.find(scope);
  if (documents.length !== taskIds.length) throw new ApiError(404, 'One or more selected tasks could not be found.');
  const requestedOrder = new Map(taskIds.map((id, index) => [String(id), index]));
  documents.sort((left, right) => requestedOrder.get(String(left._id)) - requestedOrder.get(String(right._id)));

  if (values.action === 'delete') {
    const removed = await Task.deleteMany(scope);
    if (removed.deletedCount !== taskIds.length) throw new ApiError(409, 'Some tasks changed while the bulk delete was running. Reload and try again.');
    await Promise.all(documents.map((task) => recordActivity({ actor: req.user._id, action: 'task.deleted', entityType: 'task', entityId: task._id, entityTitle: task.title, details: 'Task deleted in a bulk action' })));
    return res.json({ success: true, data: { action: values.action, count: removed.deletedCount, deletedIds: taskIds.map(String) } });
  }

  const assignees = values.action === 'assign' ? await validateAssignees(values.assignedUsers) : null;
  const now = new Date();
  const snapshots = documents.map((task) => ({ task, status: task.status, priority: task.priority, assignees: normalizeTaskShape(task).assignedUsers.map((person) => String(person?._id ?? person)) }));
  await Promise.all(snapshots.map(async ({ task }) => {
    if (values.action === 'complete') {
      task.status = 'Completed';
      task.completedAt ||= now;
    } else if (values.action === 'priority') task.priority = values.priority;
    else {
      task.assignedUsers = assignees.map((person) => person._id);
      task.assignedUser = assignees[0]?._id || null;
    }
    await task.save();
  }));

  await Promise.all(snapshots.map(async ({ task, status, priority, assignees: previousAssignees }) => {
    const nextAssignees = normalizeTaskShape(task).assignedUsers.map((person) => String(person?._id ?? person));
    const addedAssignees = nextAssignees.filter((id) => !previousAssignees.includes(id));
    const changed = status !== task.status || priority !== task.priority || previousAssignees.join(',') !== nextAssignees.join(',');
    if (!changed) return;
    if (status !== task.status) {
      const completed = task.status === 'Completed';
      await recordActivity({ actor: req.user._id, action: completed ? 'task.completed' : 'task.status_changed', entityType: 'task', entityId: task._id, entityTitle: task.title, details: completed ? 'Completed in a bulk action' : `${status} → ${task.status}` });
      const recipients = new Set([String(task.createdBy), ...previousAssignees, ...nextAssignees].filter((id) => id && id !== String(req.user._id)));
      await Promise.all([...recipients].map((user) => notifyUser({ user, task: task._id, type: completed ? 'completed' : 'updated', title: completed ? 'Task completed' : 'Task status updated', message: completed ? `${req.user.firstName} completed ${task.title}.` : `${req.user.firstName} changed ${task.title} to ${task.status}.` })));
    } else {
      await recordActivity({ actor: req.user._id, action: 'task.updated', entityType: 'task', entityId: task._id, entityTitle: task.title, details: values.action === 'priority' ? `Priority changed to ${task.priority}` : 'Assignees updated in a bulk action' });
      const recipients = new Set([String(task.createdBy), ...previousAssignees, ...nextAssignees].filter((id) => id && id !== String(req.user._id) && !addedAssignees.includes(id)));
      await Promise.all([...recipients].map((user) => notifyUser({ user, task: task._id, type: values.action === 'assign' && addedAssignees.includes(user) ? 'assigned' : 'updated', title: values.action === 'assign' && addedAssignees.includes(user) ? 'Task assigned' : 'Task updated', message: values.action === 'assign' && addedAssignees.includes(user) ? `${req.user.firstName} assigned you ${task.title}.` : `${req.user.firstName} updated ${task.title}.` })));
      await Promise.all(addedAssignees.filter((user) => user !== String(req.user._id)).map((user) => notifyUser({ user, task: task._id, type: 'assigned', title: 'Task assigned', message: `${req.user.firstName} assigned you ${task.title}.` })));
    }
  }));

  const fresh = await populateTask(Task.find({ _id: { $in: taskIds } })).lean();
  const byId = new Map(fresh.map((task) => [String(task._id), task]));
  res.json({ success: true, data: { action: values.action, count: fresh.length, tasks: taskIds.map((id) => byId.get(String(id))).filter(Boolean) } });
}
