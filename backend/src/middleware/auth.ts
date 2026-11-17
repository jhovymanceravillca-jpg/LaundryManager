import type { NextFunction, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { pool } from '../config/database';

type AuthUser = {
  id: number;
  role: 'ADMIN' | 'STAFF' | 'CLIENT';
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  tokenVersion: number;
  isClient?: boolean;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.laundry_session;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || typeof decoded.id !== 'number') throw new Error('Invalid session payload');
    payload = decoded;
  } catch {
    res.clearCookie('laundry_session');
    return res.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
  }

  const loadUser = async (withAvatar: boolean): Promise<AuthUser | undefined> => {
    const sql = withAvatar
      ? 'SELECT id, role, full_name AS fullName, email, avatar_url AS avatarUrl, token_version AS tokenVersion FROM users WHERE id = ? AND active = 1 LIMIT 1'
      : 'SELECT id, role, full_name AS fullName, email, token_version AS tokenVersion FROM users WHERE id = ? AND active = 1 LIMIT 1';
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [payload.id]);
    return rows[0] as AuthUser | undefined;
  };

  (async () => {
    let user: AuthUser | undefined;
    try {
      user = await loadUser(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === 'ER_BAD_FIELD_ERROR' || msg.includes('avatar_url') || msg.includes('Unknown column')) {
        user = await loadUser(false);
      } else {
        throw err;
      }
    }
    if (!user || Number(payload.tokenVersion ?? 0) !== Number(user.tokenVersion)) {
      res.clearCookie('laundry_session');
      res.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
      return;
    }
    let isClient = user.role === 'CLIENT';
    if (!isClient && user.email) {
      try {
        const [c] = await pool.execute<RowDataPacket[]>('SELECT id FROM customers WHERE email = ? LIMIT 1', [user.email]);
        if (c.length) isClient = true;
      } catch { /* ignore */ }
    }
    req.user = { id: user.id, role: user.role, fullName: user.fullName, avatarUrl: user.avatarUrl ?? undefined, isClient };
    req.session = { id: user.id, tokenVersion: Number(user.tokenVersion) };
    next();
  })().catch(next);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Se requiere permiso de administrador.' });
  next();
}

export function requireClient(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'CLIENT' && !req.user?.isClient) return res.status(403).json({ error: 'Se requiere cuenta de cliente.' });
  next();
}
