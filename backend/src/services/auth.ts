import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env';
import { pool } from '../config/database';
import { HttpError } from '../utils/http-error';

type SessionUser = {
  id: number;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  tokenVersion?: number;
};

type UserSessionRow = RowDataPacket & {
  id: number;
  fullName: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'STAFF';
  tokenVersion: number;
};

function issueSession(user: SessionUser) {
  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      tokenVersion: user.tokenVersion ?? 0
    },
    env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  const { tokenVersion: _tokenVersion, ...publicUser } = user;
  return { token, user: publicUser };
}

export async function createFirstAdmin(fullName: string, email: string, password: string) {
  const connection = await pool.getConnection();
  let lockAcquired = false;
  let transactionStarted = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>('SELECT GET_LOCK(?, 5) AS acquired', ['laundry_manager_first_admin']);
    if (Number(lockRows[0]?.acquired) !== 1) {
      throw new HttpError(409, 'No se pudo iniciar la configuración. Intenta de nuevo.');
    }
    lockAcquired = true;
    await connection.beginTransaction();
    transactionStarted = true;
    const [users] = await connection.query<RowDataPacket[]>('SELECT id FROM users LIMIT 1 FOR UPDATE');
    if (users.length) {
      throw new HttpError(409, 'La cuenta inicial ya fue creada. Inicia sesión.');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'ADMIN')",
      [fullName, email, passwordHash]
    );
    await connection.commit();
    transactionStarted = false;
    return issueSession({ id: Number(result.insertId), fullName, email, role: 'ADMIN' });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    try {
      if (lockAcquired) await connection.query('SELECT RELEASE_LOCK(?)', ['laundry_manager_first_admin']);
    } finally {
      connection.release();
    }
  }
}

export async function authenticate(email: string, password: string) {
  const [rows] = await pool.execute<UserSessionRow[]>(
    'SELECT id, full_name AS fullName, email, password_hash AS passwordHash, role, token_version AS tokenVersion FROM users WHERE email = ? AND active = 1 LIMIT 1',
    [email]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  try {
    await pool.execute('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ER_BAD_FIELD_ERROR')) throw error;
  }
  return issueSession({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    tokenVersion: Number(user.tokenVersion)
  });
}

export async function updateOwnProfile(userId: number, data: { fullName?: string; phone?: string | null; avatarUrl?: string | null }) {
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  if (data.fullName !== undefined) { fields.push('full_name = ?'); values.push(data.fullName); }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
  if (data.avatarUrl !== undefined) { fields.push('avatar_url = ?'); values.push(data.avatarUrl); }
  if (!fields.length) return;
  try {
    await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...values, userId]);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ER_BAD_FIELD_ERROR') {
      throw new HttpError(503, 'Falta aplicar la migración de perfil de usuario. Consulta database/migrations/005-user-profile-fields.sql.');
    }
    throw error;
  }
}

export async function changeOwnPassword(userId: number, currentPassword: string, newPassword: string) {
  const [rows] = await pool.execute<UserSessionRow[]>(
    'SELECT id, full_name AS fullName, email, password_hash AS passwordHash, role, token_version AS tokenVersion FROM users WHERE id = ? AND active = 1 LIMIT 1',
    [userId]
  );
  const user = rows[0];
  if (!user) throw new HttpError(404, 'No se encontró la cuenta.');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new HttpError(401, 'La contraseña actual no es correcta.');
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new HttpError(409, 'La nueva contraseña debe ser diferente de la actual.');
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const tokenVersion = Number(user.tokenVersion) + 1;
  await pool.execute(
    'UPDATE users SET password_hash = ?, token_version = ? WHERE id = ?',
    [passwordHash, tokenVersion, userId]
  );
  return issueSession({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    tokenVersion
  });
}

export async function revokeUserSessions(userId: number, tokenVersion: number | undefined) {
  if (typeof tokenVersion !== 'number' || !Number.isInteger(tokenVersion)) return;
  await pool.execute(
    'UPDATE users SET token_version = token_version + 1 WHERE id = ? AND token_version = ?',
    [userId, tokenVersion]
  );
}
