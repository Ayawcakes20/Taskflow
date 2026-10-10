import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { ApiError } from '../middleware/errorMiddleware.js';

export const RATE_LIMIT_COLLECTION = 'auth_rate_limits';
const indexPromises = new WeakMap();

export class MongoRateLimitStore {
  constructor(prefix, { collection = () => mongoose.connection.db.collection(RATE_LIMIT_COLLECTION), now = () => new Date() } = {}) {
    this.prefix = `${prefix}:`;
    this.localKeys = false;
    this.collection = collection;
    this.now = now;
  }

  init({ windowMs }) { this.windowMs = windowMs; }

  key(key) { return `${this.prefix}${createHash('sha256').update(key).digest('hex')}`; }

  async ready() {
    const collection = this.collection();
    // No startup writes: create the approved TTL index only when a request uses the store.
    const db = collection.s?.db || collection;
    let pending = indexPromises.get(db);
    if (!pending) {
      pending = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'auth_rate_limits_expiry' })
        .catch((error) => { indexPromises.delete(db); throw error; });
      indexPromises.set(db, pending);
    }
    await pending;
    return collection;
  }

  async increment(key) {
    try {
      const collection = await this.ready();
      const now = this.now();
      const expired = { $lte: [{ $ifNull: ['$expiresAt', new Date(0)] }, now] };
      const update = [{ $set: {
        hits: { $cond: [expired, 1, { $add: [{ $ifNull: ['$hits', 0] }, 1] }] },
        expiresAt: { $cond: [expired, new Date(now.getTime() + this.windowMs), '$expiresAt'] },
      } }];
      const filter = { _id: this.key(key) };
      let record;
      try {
        record = await collection.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after', includeResultMetadata: false });
      } catch (error) {
        if (error.code !== 11000) throw error;
        // Two instances can race to insert a new key; increment the winner atomically.
        record = await collection.findOneAndUpdate(filter, update, { returnDocument: 'after', includeResultMetadata: false });
      }
      if (!record) throw new Error('Counter unavailable');
      return { totalHits: record.hits, resetTime: record.expiresAt };
    } catch { throw new ApiError(503, 'Authentication is temporarily unavailable. Please try again shortly.'); }
  }

  async decrement(key) {
    const collection = await this.ready();
    await collection.updateOne({ _id: this.key(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    const collection = await this.ready();
    await collection.deleteOne({ _id: this.key(key) });
  }
}
