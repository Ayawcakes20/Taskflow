import { Router } from 'express';
import { changePassword, currentUser, login, logout, register } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { verifyRegistration, resendRegistration, forgotPassword, resendRecovery, verifyRecovery, resetPassword } from '../controllers/otpController.js';
import { createOtpRateLimits } from '../middleware/authRateLimits.js';

const router = Router();
const otpLimits = createOtpRateLimits();
router.post('/register', otpLimits.requests, register);
router.post('/register/verify', otpLimits.verifications, verifyRegistration);
router.post('/register/resend', otpLimits.requests, resendRegistration);
router.post('/forgot-password', otpLimits.requests, forgotPassword);
router.post('/forgot-password/resend', otpLimits.requests, resendRecovery);
router.post('/forgot-password/verify', otpLimits.verifications, verifyRecovery);
router.post('/reset-password', otpLimits.verifications, resetPassword);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, currentUser);
router.put('/password', protect, changePassword);

export default router;
