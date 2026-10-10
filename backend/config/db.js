import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

// One connection and one pending attempt per warm function instance.
let connectionPromise;

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

export function connectDatabase() {
  if (isDatabaseReady()) return Promise.resolve(true);
  if (connectionPromise) return connectionPromise;
  const production = process.env.NODE_ENV === 'production';
  const uri = process.env.MONGO_URI || (!production && 'mongodb://127.0.0.1:27017/task_management');
  const dbName = process.env.MONGO_DB_NAME || (!production && 'task_management');
  if (!uri || !dbName) return Promise.resolve(false);

  connectionPromise = Promise.resolve().then(() => mongoose.connect(uri, {
    dbName,
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
    waitQueueTimeoutMS: 3500,
    serverSelectionTimeoutMS: 3500,
    connectTimeoutMS: 3500,
    autoIndex: !production,
  })).then(() => true).catch(() => {
    // Driver messages can contain connection information. Never log them.
    console.warn('MongoDB connection unavailable. A subsequent request may retry.');
    return false;
  }).finally(() => { connectionPromise = undefined; });
  return connectionPromise;
}

mongoose.connection.on('error', () => console.warn('MongoDB connection error.'));
