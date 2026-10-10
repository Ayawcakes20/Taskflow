import ActivityLog from '../models/ActivityLog.js';
import { paginationFrom, escapeRegex } from '../utils/query.js';

export async function listActivity(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const filter = req.user.role === 'Admin'
    ? {}
    : { $or: [{ actor: req.user._id }, { targetUser: req.user._id }] };
  if (req.query.action) filter.action = req.query.action;
  if (req.query.q?.trim()) filter.entityTitle = new RegExp(escapeRegex(req.query.q.trim().slice(0, 100)), 'i');
  const [items, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'firstName lastName username profileImage').populate('targetUser', 'firstName lastName username').lean(),
    ActivityLog.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } } });
}
