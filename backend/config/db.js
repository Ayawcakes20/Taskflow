import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

let retryTimer;
let connectionStarted = false;

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase() {
  if (connectionStarted && isDatabaseReady()) return true;
  connectionStarted = true;
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/task_management';

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3500,
      connectTimeoutMS: 3500,
      dbName: process.env.MONGO_DB_NAME || 'task_management',
    });
    clearTimeout(retryTimer);
    console.info('MongoDB connected.');
    return true;
  } catch (error) {
    console.error(`MongoDB unavailable: ${error.message}. Retrying in 8 seconds.`);
    connectionStarted = false;
    retryTimer = setTimeout(() => void connectDatabase(), 8000);
    retryTimer.unref?.();
    return false;
  }
}

mongoose.connection.on('connected', () => console.info('MongoDB connection ready.'));
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected; Mongoose will reconnect when possible.');
  connectionStarted = false;
  if (!retryTimer) {
    retryTimer = setTimeout(() => void connectDatabase(), 8000);
    retryTimer.unref?.();
  }
});
mongoose.connection.on('error', (error) => console.error(`MongoDB connection error: ${error.message}`));
