import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, trim: true, maxlength: 80 },
    entityType: { type: String, enum: ['task', 'user', 'auth', 'system'], default: 'system' },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    entityTitle: { type: String, trim: true, default: '', maxlength: 180 },
    details: { type: String, trim: true, default: '', maxlength: 500 },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ actor: 1, createdAt: -1 });

export default mongoose.model('ActivityLog', activityLogSchema);
