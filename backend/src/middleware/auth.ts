import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.laundry_session;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      id: number; role: 'ADMIN' | 'STAFF'; fullName: string;
    };
    req.user = payload;
    next();
  } catch {
    res.clearCookie('laundry_session');
    return res.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Se requiere permiso de administrador.' });
  next();
}
