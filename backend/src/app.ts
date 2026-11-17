import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { api } from './routes/api';
import { errorHandler } from './middleware/errors';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/setup', authRateLimit);
app.use('/api/auth/password', authRateLimit);
app.use('/api', api);

// Servir el frontend compilado (monorepo) cuando exista dist.
// Se resuelve relativo a backend/dist (o backend/src en dev) para que funcione
// aunque el proceso arranque desde la raíz del repo o desde backend/.
const candidates = [
  path.resolve(__dirname, '..', '..', 'frontend', 'dist'),
  path.resolve(__dirname, '..', 'frontend', 'dist'),
  path.resolve(process.cwd(), 'frontend', 'dist')
];
const frontendDist = candidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.use((_req, res) => res.status(404).json({ error: 'No se encontró el recurso solicitado.' }));
}
app.use(errorHandler);
