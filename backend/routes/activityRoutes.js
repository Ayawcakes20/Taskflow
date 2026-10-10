import { Router } from 'express';
import { listActivity } from '../controllers/activityController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.use(protect);
router.get('/', listActivity);

export default router;
