import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { ApiError } from '../middleware/errorMiddleware.js';
import { OtpStore } from './otpStore.js';
import { emailDelivery } from './otpEmail.js';

const FIVE_MINUTES = 5 * 60 * 1000;
export const accountActions = {
  duplicate: (email, username) => User.findOne({ $or: [{ email }, { username }] }).select('_id email username'),
  recoveryUser: (email) => User.findOne({ email, isActive: true }).select('_id +sessionVersion'),
  async create(registration) {
    const { passwordHash, ...values } = registration;
    const user = new User({ ...values, password: passwordHash });
    // Only server-held, already-validated pending registration hashes use this flag.
    user.$locals.passwordPrehashed = true;
    await user.save();
    return user;
  },
  async reset(record, passwordHash) {
    const version = record.sessionVersion ?? 0;
    const versionFilter = version === 0 ? { $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }] } : { sessionVersion: version };
    return User.findOneAndUpdate({ _id: record.userId, isActive: true, ...versionFilter },
      { $set: { password: passwordHash }, $inc: { sessionVersion: 1 } }, { new: true });
  },
};

function codeDigest(challengeId, purpose, code) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(503, 'Authentication is temporarily unavailable.');
  // HMAC resists offline brute forcing of six-digit codes if only the DB is disclosed.
  return createHmac('sha256', secret).update(`taskflow:otp:${purpose}:${challengeId}:${code}`).digest('hex');
}
const tokenDigest = (token) => createHash('sha256').update(token).digest('hex');
export function maskedEmail(email) {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export function createOtpService({ store = new OtpStore(), accounts = accountActions, delivery = emailDelivery, now = () => Date.now() } = {}) {
  const publicChallenge = (record) => ({ challengeId: record.challengeId, emailHint: maskedEmail(record.email),
    expiresAt: record.otpExpiresAt.toISOString(), resendAt: record.resendAt.toISOString() });
  async function issue(purpose, email, registration) {
    delivery.assertConfigured();
    let fields = {};
    if (purpose === 'registration') {
      const duplicate = await accounts.duplicate(email, registration.username);
      if (duplicate) throw new ApiError(409, duplicate.email === email ? 'An account with this email already exists.' : 'That username is already in use.');
      const { password, confirmPassword: _confirmation, ...values } = registration;
      fields.registration = { ...values, passwordHash: await bcrypt.hash(password, 12) };
    } else {
      const user = await accounts.recoveryUser(email);
      fields = { userId: user?._id || null, sessionVersion: user?.sessionVersion ?? 0 };
    }
    return send(purpose, email, fields);
  }
  async function send(purpose, email, fields) {
    const challengeId = randomBytes(32).toString('hex');
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const record = await store.reserve(purpose, email, { ...fields, challengeId,
      otpHash: codeDigest(challengeId, purpose, code), otpExpiresAt: new Date(now() + FIVE_MINUTES) });
    if (purpose === 'recovery' && !record.userId) { await store.delivered(record, false); return publicChallenge(record); }
    try {
      await delivery.send({ email, code, purpose, challengeId });
      await store.delivered(record, true);
    } catch (error) {
      await store.delivered(record, false);
      if (purpose === 'registration') throw error;
      // Recovery responses never distinguish unknown accounts or provider failures.
      // This is a conditional acknowledgement, not a claim that an email was sent.
    }
    return publicChallenge(record);
  }
  return {
    issue,
    async resend(challengeId, purpose) {
      const record = await store.get(challengeId, purpose);
      if (!record) throw new ApiError(400, 'This request is no longer available. Start again.');
      if (purpose === 'registration') {
        if (!record.registration || record.status === 'consumed') throw new ApiError(400, 'Start registration again.');
        if (await accounts.duplicate(record.email, record.registration.username)) throw new ApiError(409, 'That account already exists. Please sign in.');
        return send(purpose, record.email, { registration: record.registration });
      }
      const user = await accounts.recoveryUser(record.email);
      return send(purpose, record.email, { userId: user?._id || null, sessionVersion: user?.sessionVersion ?? 0 });
    },
    async verifyRegistration(challengeId, code) {
      const record = await store.verify(challengeId, 'registration', codeDigest(challengeId, 'registration', code));
      try {
        if (await accounts.duplicate(record.email, record.registration.username)) throw new ApiError(409, 'That account already exists. Please sign in.');
        return await accounts.create(record.registration);
      } finally { await store.clearRegistration(record); }
    },
    async verifyRecovery(challengeId, code) {
      const resetToken = randomBytes(32).toString('hex');
      const resetExpiresAt = new Date(now() + FIVE_MINUTES);
      await store.verify(challengeId, 'recovery', codeDigest(challengeId, 'recovery', code),
        { resetTokenHash: tokenDigest(resetToken), resetExpiresAt });
      return { resetToken, expiresAt: resetExpiresAt.toISOString() };
    },
    async resetPassword(challengeId, resetToken, password) {
      // Hash before consuming; validation failures do not destroy a valid reset grant.
      const hash = await bcrypt.hash(password, 12);
      const record = await store.consumeReset(challengeId, tokenDigest(resetToken));
      if (!record || !record.userId || !(await accounts.reset(record, hash))) throw new ApiError(400, 'This reset request is invalid or expired. Request a new code.');
    },
  };
}
export const otpService = createOtpService();
