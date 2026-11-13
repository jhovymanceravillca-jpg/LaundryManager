import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { api } from './routes/api';
import { errorHandler } from './middleware/errors';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/setup', authRateLimit);
app.use('/api', api);
app.use((_req, res) => res.status(404).json({ error: 'No se encontró el recurso solicitado.' }));
app.use(errorHandler);
