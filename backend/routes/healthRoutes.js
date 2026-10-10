import { Router } from 'express';
import { connectDatabase } from '../config/db.js';

export async function healthCheck(_req, res) {
  const connected = await connectDatabase();
  res.json({ success: true, service: 'taskflow-api', database: connected ? 'connected' : 'unavailable' });
}

const router = Router();

router.get('/health', healthCheck);

router.get('/', (_req, res) => {
  res.json({ success: true, message: 'Taskflow API is running.' });
});

export default router;
