import { Router } from 'express';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.use(protect);
router.get('/', listNotifications);
router.put('/read-all', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);

export default router;
