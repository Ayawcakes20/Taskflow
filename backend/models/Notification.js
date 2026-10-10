import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    type: { type: String, enum: ['assigned', 'updated', 'completed', 'approaching_deadline', 'overdue', 'comment', 'system'], default: 'system' },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String, default: null, unique: true, sparse: true },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
