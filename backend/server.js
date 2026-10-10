import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { connectDatabase, isDatabaseReady } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { getReports } from './controllers/reportController.js';
import { protect } from './middleware/authMiddleware.js';
import healthRoutes from './routes/healthRoutes.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/errorMiddleware.js';

const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, '..');
const frontendDist = path.resolve(rootDir, 'frontend/dist');
const port = Number(process.env.PORT) || 5000;
const allowedOrigins = [...new Set([
  ...(process.env.CLIENT_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean),
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])];

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  frameguard: false,
  contentSecurityPolicy: { directives: {
    frameAncestors: ["'self'", 'https://*.manus.computer', 'https://manus.im', 'https://*.manus.im'],
    imgSrc: ["'self'", 'data:', 'https:'],
    styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
    styleSrcAttr: ["'unsafe-inline'"],
  } },
}));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.manus.computer') || origin.endsWith('.manus.space')) return callback(null, true);
    return callback(new Error('Origin not allowed.'));
  },
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ success: true, service: 'taskflow-api', database: isDatabaseReady() ? 'connected' : 'unavailable' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: 'draft-8', legacyHeaders: false }));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.path === '/health' || (req.path === '/auth/logout' && req.method === 'POST') || isDatabaseReady()) return next();
  return res.status(503).json({ success: false, message: 'MongoDB is not available. Check the server connection and try again.' });
});
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.get('/api/reports', protect, getReports);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
    res.sendFile(path.join(frontendDist, 'index.html'), (error) => error && next(error));
  });
}

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const server = app.listen(port, '0.0.0.0', () => {
  console.info(`Taskflow API listening on port ${port}.`);
  void connectDatabase();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
