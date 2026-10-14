import { Router } from 'express';
import { changePassword, currentUser, login, logout, register } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.post('/register', register);
// Fail closed, including previously issued recovery grants. No password-reset bypass.
const emailFeaturesUnavailable = (_req, res) => res.status(503).json({ success: false,
  message: 'Email-code verification and password recovery are temporarily unavailable. Please contact an administrator.' });
for (const path of ['/register/verify', '/register/resend', '/forgot-password', '/forgot-password/resend', '/forgot-password/verify', '/reset-password']) {
  router.post(path, emailFeaturesUnavailable);
}
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, currentUser);
router.put('/password', protect, changePassword);

export default router;
