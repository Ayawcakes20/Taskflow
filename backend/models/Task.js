import mongoose from 'mongoose';

const objectId = mongoose.Schema.Types.ObjectId;
const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  completed: { type: Boolean, default: false },
});
const commentSchema = new mongoose.Schema({
  user: { type: objectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 5000 },
  mentions: { type: [{ type: objectId, ref: 'User' }], default: [] },
}, { timestamps: true });
const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, trim: true, default: '', maxlength: 5000 },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
    category: { type: String, trim: true, default: 'General', maxlength: 80 },
    assignedUsers: { type: [{ type: objectId, ref: 'User' }], default: [] },
    // Kept for existing documents and older clients; assignedUsers is canonical.
    assignedUser: { type: objectId, ref: 'User', default: null },
    createdBy: { type: objectId, ref: 'User', required: true },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    imageUrl: { type: String, default: null, maxlength: 1_500_000 },
    imageThumbnail: { type: String, default: null, maxlength: 180_000 },
    subtasks: { type: [subtaskSchema], default: [], validate: { validator: (items) => items.length <= 100, message: 'A task can have at most 100 subtasks.' } },
    comments: { type: [commentSchema], default: [], validate: { validator: (items) => items.length <= 500, message: 'A task can have at most 500 comments.' } },
  },
  { timestamps: true },
);

taskSchema.pre('validate', function keepLegacyAssigneeInSync() {
  const selected = Array.isArray(this.assignedUsers) ? this.assignedUsers : [];
  const unique = [...new Map(selected.map((id) => [String(id), id])).values()];
  if (!unique.length && this.assignedUser) unique.push(this.assignedUser);
  this.assignedUsers = unique;
  this.assignedUser = unique[0] || null;
});

taskSchema.index({ title: 'text', description: 'text', category: 'text' });
taskSchema.index({ createdBy: 1, dueDate: 1 });
taskSchema.index({ assignedUsers: 1, status: 1, dueDate: 1 });
taskSchema.index({ assignedUser: 1, status: 1, dueDate: 1 });
taskSchema.index({ status: 1, priority: 1, updatedAt: -1 });

export default mongoose.model('Task', taskSchema);
