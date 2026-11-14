import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, get } from './db.js';
import { seed } from './seed/index.js';
import { loadUser, csrfGuard } from './auth.js';
import { startScheduler } from './services/scheduler.js';
import { getVapid } from './services/notifier.js';
import authRoutes from './routes/auth.js';
import toolRoutes from './routes/tools.js';
import pathRoutes from './routes/paths.js';
import assessmentRoutes from './routes/assessments.js';
import resourceRoutes from './routes/resources.js';
import meRoutes from './routes/me.js';
import adminRoutes from './routes/admin.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  // log strutturato delle richieste API
  app.use('/api', (req, res, next) => {
    const t = Date.now();
    res.on('finish', () => {
      if (process.env.NODE_ENV === 'test') return;
      console.log(JSON.stringify({ level: res.statusCode >= 500 ? 'error' : 'info', msg: 'http', method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - t, user: req.user?.id }));
    });
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(loadUser);
  app.use('/api', csrfGuard);

  app.get('/api/health', (_req, res) => res.json({ ok: true, db: !!get('SELECT 1 AS ok').ok, time: new Date().toISOString() }));
  app.use('/api/auth', authRoutes);
  app.use('/api', toolRoutes);
  app.use('/api', resourceRoutes);
  app.use('/api', pathRoutes);
  app.use('/api', assessmentRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Risorsa non trovata' }));

  app.use(express.static(path.join(here, '..', 'public'), { index: 'index.html', maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

  // gestione errori centralizzata
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON non valido' });
    console.error(JSON.stringify({ level: 'error', msg: 'unhandled', path: req.path, error: err.message, stack: err.stack?.split('\n').slice(0, 4).join(' | ') }));
    res.status(500).json({ error: 'Errore interno. L’evento è stato registrato.' });
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  openDb();
  const s = seed();
  if (Object.values(s).some((v) => v > 0)) console.log(JSON.stringify({ level: 'info', msg: 'seed', ...s }));
  getVapid();
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(JSON.stringify({ level: 'info', msg: `Atlante AI in ascolto su http://localhost:${port}` })));
  if (process.env.DISABLE_SCHEDULER !== '1') startScheduler();
}
