import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'Workspace';
const lastName = process.env.ADMIN_LAST_NAME?.trim() || 'Administrator';
const username = process.env.ADMIN_USERNAME?.trim().toLowerCase() || 'admin';

if (!email || !password || password.length < 8) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 8 characters) before running the one-time admin seed.');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/task_management', { dbName: process.env.MONGO_DB_NAME || 'task_management' });
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    existing.role = 'Admin';
    existing.isActive = true;
    await existing.save();
    console.info(`Promoted ${email} to Admin.`);
  } else {
    await User.create({ firstName, lastName, username, email, password, role: 'Admin' });
    console.info(`Created Admin account for ${email}.`);
  }
} catch (error) {
  console.error(`Admin seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
