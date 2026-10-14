import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { ApiError } from '../middleware/errorMiddleware.js';

export const OTP_COLLECTION = 'auth_otp_challenges';
const indexes = new WeakMap();
const HOUR = 60 * 60 * 1000;

// A dedicated temporary collection; no changes to existing user/account schemas.
export class OtpStore {
  constructor({ collection = () => mongoose.connection.db.collection(OTP_COLLECTION), now = () => Date.now() } = {}) {
    this.collection = collection; this.now = now;
  }

  async ready() {
    const collection = this.collection();
    const owner = collection.s?.db || collection;
    let promise = indexes.get(owner);
    if (!promise) {
      promise = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'auth_otp_expiry' })
        .catch((error) => { indexes.delete(owner); throw error; });
      indexes.set(owner, promise);
    }
    await promise;
    return collection;
  }

  async reserve(purpose, email, fields) {
    const collection = await this.ready();
    const now = this.now();
    const _id = createHash('sha256').update(`${purpose}\0${email}`).digest('hex');
    for (let attempt = 0; attempt < 3; attempt++) {
      const old = await collection.findOne({ _id });
      if (old && old.resendAt.getTime() > now) {
        throw new ApiError(429, 'Please wait before requesting another code.', { retryAfterSeconds: Math.ceil((old.resendAt.getTime() - now) / 1000) });
      }
      const sameWindow = old && old.windowStart.getTime() > now - HOUR;
      const count = sameWindow ? old.requestCount : 0;
      if (count >= 6) throw new ApiError(429, 'Too many code requests. Please try again later.', { retryAfterSeconds: Math.ceil((old.windowStart.getTime() + HOUR - now) / 1000) });
      const record = { ...fields, purpose, email, status: 'sending', attempts: 0,
        resendAt: new Date(now + 60000), windowStart: sameWindow ? old.windowStart : new Date(now), requestCount: count + 1,
        expiresAt: new Date(now + HOUR) };
      if (!old) {
        try { await collection.insertOne({ _id, ...record }); return { _id, ...record }; }
        catch (error) { if (error.code !== 11000) throw error; }
      } else {
        const result = await collection.findOneAndUpdate({ _id, challengeId: old.challengeId },
          { $set: record, $unset: { resetTokenHash: '', resetExpiresAt: '' } }, { returnDocument: 'after', includeResultMetadata: false });
        if (result) return result;
      }
    }
    throw new ApiError(429, 'Another code request is in progress. Please try again shortly.');
  }

  async delivered(record, success) {
    const collection = await this.ready();
    await collection.updateOne({ _id: record._id, challengeId: record.challengeId, status: 'sending' },
      success ? { $set: { status: 'issued' } } : { $set: { status: 'failed' }, $unset: { otpHash: '', registration: '' } });
  }

  async get(challengeId, purpose) {
    return (await this.ready()).findOne({ challengeId, purpose });
  }

  async verify(challengeId, purpose, otpHash, next = {}) {
    const collection = await this.ready();
    const valid = { challengeId, purpose, status: 'issued', attempts: { $lt: 5 }, otpExpiresAt: { $gt: new Date(this.now()) } };
    // One atomic winner consumes the code. Concurrent incorrect guesses cannot exceed five.
    const record = await collection.findOneAndUpdate({ ...valid, otpHash },
      { $set: { status: purpose === 'registration' ? 'consumed' : 'verified', ...next }, $unset: { otpHash: '' } },
      { returnDocument: 'after', includeResultMetadata: false });
    if (record) return record;
    await collection.updateOne({ ...valid, otpHash: { $ne: otpHash } }, { $inc: { attempts: 1 } });
    throw new ApiError(400, 'The code is invalid, expired, or no longer available. Request a new code if needed.');
  }

  async consumeReset(challengeId, resetTokenHash) {
    return (await this.ready()).findOneAndUpdate({ challengeId, purpose: 'recovery', status: 'verified', resetTokenHash,
      resetExpiresAt: { $gt: new Date(this.now()) } },
    { $set: { status: 'consumed' }, $unset: { resetTokenHash: '' } }, { returnDocument: 'after', includeResultMetadata: false });
  }

  async clearRegistration(record) {
    await (await this.ready()).updateOne({ _id: record._id, challengeId: record.challengeId }, { $unset: { registration: '' } });
  }
}
