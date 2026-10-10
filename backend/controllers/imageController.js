import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { visibleTo } from './taskController.js';
import { ApiError } from '../middleware/errorMiddleware.js';

function sendImage(value, res) {
  const match = typeof value === 'string' && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) throw new ApiError(404, 'Image not found.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 1024 * 1024) throw new ApiError(413, 'Image exceeds the supported size.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type(match[1]).send(bytes);
}

export async function getTaskImage(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Image not found.');
  const field = req.query.variant === 'thumbnail' ? 'imageThumbnail' : 'imageUrl';
  const task = await Task.findOne({ _id: req.params.id, ...visibleTo(req.user) }).select(field).lean();
  if (!task) throw new ApiError(404, 'Image not found.');
  sendImage(task[field], res);
}

export async function getUserImage(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Image not found.');
  // Active users' avatars are already visible in the authenticated assignee directory.
  const user = await User.findOne({ _id: req.params.id }).select('profileImage isActive').lean();
  if (!user) throw new ApiError(404, 'Image not found.');
  if (!user.isActive && req.user.role !== 'Admin' && String(req.user._id) !== req.params.id) {
    // Retain historical avatars in tasks the requester may view, including comments.
    const related = await Task.exists({ $and: [visibleTo(req.user), { $or: [
      { assignedUsers: req.params.id }, { assignedUser: req.params.id }, { createdBy: req.params.id },
      { 'comments.user': req.params.id }, { 'comments.mentions': req.params.id },
    ] }] });
    if (!related) throw new ApiError(404, 'Image not found.');
  }
  sendImage(user.profileImage, res);
}
