import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { APP_ROOT, getDb, saveDb, verifyDbHealth } from './server/db.js';
import { apiRouter } from './server/api.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Disable ETag caching so API lists always reflect live SQLite state
  app.set('etag', false);

  // Initialize SQLite database
  await getDb();

  app.use(express.json());
  app.use(cookieParser());

  // Prevent browser or proxy caching on all /api endpoints
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    const dbHealth = verifyDbHealth();
    res.status(dbHealth.ok ? 200 : 503).json({
      status: dbHealth.ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      dbConnected: dbHealth.ok,
      projectsCount: dbHealth.projectsCount,
    });
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Global JSON error handler for /api routes
  app.use('/api', (err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error('API Error:', err);
    if (res.headersSent) return;
    res.status(err?.status || 500).json({
      error: err?.message || 'Internal server error. Database operation failed.',
    });
  });

  // Vite middleware for development / static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(APP_ROOT, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Construction Accounting Server running on http://0.0.0.0:${PORT}`);
  });

  const handleShutdown = () => {
    try {
      saveDb();
    } catch (err) {
      console.error('Error flushing database on shutdown:', err);
    }
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
