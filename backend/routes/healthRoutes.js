import { Router } from 'express';
import { isDatabaseReady } from '../config/db.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, service: 'taskflow-api', database: isDatabaseReady() ? 'connected' : 'unavailable' });
});

router.get('/', (_req, res) => {
  res.json({ success: true, message: 'Taskflow API is running.' });
});

export default router;
