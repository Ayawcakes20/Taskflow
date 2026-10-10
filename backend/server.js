import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { createAuthRateLimits } from './middleware/authRateLimits.js';
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
import { databaseReady } from './middleware/databaseReady.js';
import { validateProductionConfig, trustedOrigins } from './config/production.js';
import { trustedOrigin } from './middleware/trustedOrigin.js';
import { imageResponses } from './middleware/imageResponses.js';

validateProductionConfig();
const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, '..');
const frontendDist = path.resolve(rootDir, 'frontend/dist');
const port = Number(process.env.PORT) || 5000;
const allowedOrigins = trustedOrigins();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  frameguard: false,
  contentSecurityPolicy: { directives: {
    frameAncestors: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
    styleSrcAttr: ["'unsafe-inline'"],
  } },
}));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    return callback(null, !origin || allowedOrigins.has(origin));
  },
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api', trustedOrigin(allowedOrigins));
app.use('/api', imageResponses);

app.get('/api/health', (_req, res) => res.json({ success: true, service: 'taskflow-api', database: isDatabaseReady() ? 'connected' : 'unavailable' }));
app.use('/api', databaseReady());
app.use('/api/auth', createAuthRateLimits());
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.get('/api/reports', protect, getReports);

if (process.env.NODE_ENV === 'production' && process.env.SERVE_FRONTEND === 'true' && !process.env.VERCEL) {
  app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
    res.sendFile(path.join(frontendDist, 'index.html'), (error) => error && next(error));
  });
}

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;

// Vercel imports the app. Direct local execution keeps the existing start/dev commands.
if (!process.env.VERCEL && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.info(`Taskflow API listening on port ${port}.`);
    void connectDatabase();
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(() => process.exit(0));
    });
  }
}
