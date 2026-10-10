import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController.js';
import { getReports } from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.use(protect);
router.get('/', getDashboard);
router.get('/reports', getReports);

export default router;
