import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, required: true, trim: true, lowercase: true, minlength: 3, maxlength: 30, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, minlength: 8, select: false },
    sessionVersion: { type: Number, default: 0, select: false },
    role: { type: String, enum: ['User', 'Admin'], default: 'User' },
    profileImage: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
      notifications: {
        assignments: { type: Boolean, default: true },
        updates: { type: Boolean, default: true },
        deadlines: { type: Boolean, default: true },
        mentions: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true, toJSON: { virtuals: true, transform: hidePassword } },
);

function hidePassword(_doc, result) {
  delete result.password;
  delete result.sessionVersion;
  delete result.__v;
  return result;
}

userSchema.index({ lastName: 1, firstName: 1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
