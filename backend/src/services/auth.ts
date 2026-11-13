import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { pool } from '../config/database';

export async function createFirstAdmin(fullName: string, email: string, password: string) {
  const connection = await pool.getConnection();
  let lockAcquired = false;
  let transactionStarted = false;
  try {
    const [lockRows] = await connection.query<any[]>('SELECT GET_LOCK(?, 5) AS acquired', ['laundry_manager_first_admin']);
    if (Number(lockRows[0]?.acquired) !== 1) {
      throw Object.assign(new Error('No se pudo iniciar la configuración. Intenta de nuevo.'), { status: 409 });
    }
    lockAcquired = true;
    await connection.beginTransaction();
    transactionStarted = true;
    const [users] = await connection.query<any[]>('SELECT id FROM users LIMIT 1 FOR UPDATE');
    if (users.length) {
      throw Object.assign(new Error('La cuenta inicial ya fue creada. Inicia sesión.'), { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await connection.execute<any>(
      "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'ADMIN')",
      [fullName, email, passwordHash]
    );
    await connection.commit();
    transactionStarted = false;
    const user = { id: Number(result.insertId), fullName, email, role: 'ADMIN' as const };
    const token = jwt.sign(
      { id: user.id, role: user.role, fullName: user.fullName },
      env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    return { token, user };
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
  const [rows] = await pool.execute<any[]>(
    'SELECT id, full_name AS fullName, email, password_hash AS passwordHash, role FROM users WHERE email = ? AND active = 1 LIMIT 1',
    [email]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  const token = jwt.sign(
    { id: user.id, role: user.role, fullName: user.fullName },
    env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  return { token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } };
}
