import { Router } from 'express';
import { changePassword, currentUser, login, logout, register } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { forgotPassword, resendRecovery, verifyRecovery, resetPassword } from '../controllers/otpController.js';
import { createOtpRateLimits } from '../middleware/authRateLimits.js';

const router = Router();
router.post('/register', register);
// Registration remains direct; registration-code endpoints stay disabled.
const emailFeaturesUnavailable = (_req, res) => res.status(503).json({ success: false,
  message: 'Registration email-code verification is currently disabled. Please register directly.' });
for (const path of ['/register/verify', '/register/resend']) {
  router.post(path, emailFeaturesUnavailable);
}
const otpLimits = createOtpRateLimits();
router.post('/forgot-password', otpLimits.requests, forgotPassword);
router.post('/forgot-password/resend', otpLimits.requests, resendRecovery);
router.post('/forgot-password/verify', otpLimits.verifications, verifyRecovery);
router.post('/reset-password', otpLimits.verifications, resetPassword);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, currentUser);
router.put('/password', protect, changePassword);

export default router;
