import { setSession } from './authController.js';
import { otpService } from '../utils/otpService.js';
import { otpRequestSchema, otpChallengeSchema, otpVerifySchema, passwordResetSchema } from '../utils/validation.js';
import { recordActivity } from '../utils/activity.js';

export async function verifyRegistration(req, res) {
  const { challengeId, code } = otpVerifySchema.parse(req.body);
  const user = await otpService.verifyRegistration(challengeId, code);
  setSession(res, user);
  await recordActivity({ actor: user._id, action: 'user.registered', entityType: 'user', entityId: user._id, entityTitle: `${user.firstName} ${user.lastName}` });
  res.status(201).json({ success: true, data: { user: user.toJSON() } });
}
export async function resendRegistration(req, res) {
  const { challengeId } = otpChallengeSchema.parse(req.body);
  res.json({ success: true, data: await otpService.resend(challengeId, 'registration') });
}
export async function forgotPassword(req, res) {
  const { email } = otpRequestSchema.parse(req.body);
  res.status(202).json({ success: true, message: 'If an eligible account exists, a recovery code will be emailed.', data: await otpService.issue('recovery', email.toLowerCase()) });
}
export async function resendRecovery(req, res) {
  const { challengeId } = otpChallengeSchema.parse(req.body);
  res.json({ success: true, message: 'If an eligible account exists, a recovery code will be emailed.', data: await otpService.resend(challengeId, 'recovery') });
}
export async function verifyRecovery(req, res) {
  const { challengeId, code } = otpVerifySchema.parse(req.body);
  res.json({ success: true, data: await otpService.verifyRecovery(challengeId, code) });
}
export async function resetPassword(req, res) {
  const values = passwordResetSchema.parse(req.body);
  await otpService.resetPassword(values.challengeId, values.resetToken, values.newPassword);
  res.json({ success: true, message: 'Password reset successfully. Sign in with your new password.' });
}
