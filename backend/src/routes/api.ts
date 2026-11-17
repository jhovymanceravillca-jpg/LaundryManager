import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { pool } from '../config/database';
import { env } from '../config/env';
import { requireAdmin, requireAuth, requireClient } from '../middleware/auth';
import { HttpError } from '../utils/http-error';
import { authenticate, changeOwnPassword, createFirstAdmin, revokeUserSessions, updateOwnProfile } from '../services/auth';
import { createOrder, deliverOrder, registerPayment, updateOrderStatus, voidPayment } from '../services/orders';
import { toMySqlUtcDateTime } from '../utils/datetime';

export const api = Router();
const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);
const setSessionCookie = (res: Response, token: string) => res.cookie('laundry_session', token, {
  httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE === 'true',
  maxAge: 8 * 60 * 60 * 1000, path: '/'
});
const positiveId = z.coerce.number().int().positive();
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50)
});
const paginationFor = (query: unknown) => {
  const { page, pageSize } = paginationSchema.parse(query);
  return { page, pageSize, offset: (page - 1) * pageSize };
};
const pageResult = (items: unknown, total: unknown, page: number, pageSize: number) => ({
  items,
  page,
  pageSize,
  total: Number(total)
});
const customerSchema = z.object({
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(1).max(40), address: z.string().trim().max(255).optional(),
  email: z.string().trim().email().max(190).optional().or(z.literal(''))
});
const appearanceSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontFamily: z.enum(['system', 'arial', 'verdana', 'trebuchet', 'georgia', 'mono']),
  backgroundMode: z.enum(['light', 'dark'])
});

api.get('/health', (_req, res) => res.json({ status: 'ok' }));
api.get('/health/database', requireAuth, asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));
api.get('/settings/appearance', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT accent_color AS accentColor, font_family AS fontFamily, background_mode AS backgroundMode
     FROM app_settings WHERE setting_key = 'appearance'`
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json(rows[0] ?? { accentColor: '#2863e9', fontFamily: 'system', backgroundMode: 'light' });
}));
api.put('/settings/appearance', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const appearance = appearanceSchema.parse(req.body);
  await pool.execute(
    `INSERT INTO app_settings (setting_key, accent_color, font_family, background_mode)
     VALUES ('appearance', ?, ?, ?)
     ON DUPLICATE KEY UPDATE accent_color = VALUES(accent_color), font_family = VALUES(font_family),
       background_mode = VALUES(background_mode)`,
    [appearance.accentColor, appearance.fontFamily, appearance.backgroundMode]
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json(appearance);
}));

api.get('/auth/setup-status', asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT EXISTS(SELECT 1 FROM users LIMIT 1) AS hasAdmin');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ setupRequired: !Boolean(rows[0]?.hasAdmin) });
}));
api.post('/auth/setup', asyncRoute(async (req, res) => {
  const data = z.object({
    fullName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(190),
    password: z.string().min(12).max(200)
  }).parse(req.body);
  let result;
  try {
    result = await createFirstAdmin(data.fullName, data.email, data.password);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'La cuenta inicial ya fue creada. Inicia sesión.');
    }
    throw error;
  }
  setSessionCookie(res, result.token);
  res.status(201).json({ user: result.user });
}));
api.post('/auth/login', asyncRoute(async (req, res) => {
  const data = z.object({ email: z.string().email(), password: z.string().min(1).max(200) }).parse(req.body);
  const result = await authenticate(data.email, data.password);
  if (!result) throw new HttpError(401, 'Correo o contraseña incorrectos.');
  setSessionCookie(res, result.token);
  // Determine if this is a client account
  const [cust] = await pool.execute<RowDataPacket[]>('SELECT id FROM customers WHERE email = ? LIMIT 1', [result.user.email]);
  return res.json({ user: { ...result.user, isClient: cust.length > 0 || (result.user.role as string) === 'CLIENT' } });
}));
api.patch('/auth/password', requireAuth, asyncRoute(async (req, res) => {
  const data = z.object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(12).max(200)
  }).parse(req.body);
  const result = await changeOwnPassword(req.user!.id, data.currentPassword, data.newPassword);
  setSessionCookie(res, result.token);
  res.json({ user: result.user });
}));
api.post('/auth/register-client', asyncRoute(async (req, res) => {
  const data = z.object({
    fullName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(190),
    password: z.string().min(8).max(200),
    phone: z.string().trim().max(40).optional()
  }).parse(req.body);
  const parts = data.fullName.split(' ').filter(Boolean);
  const firstName = parts[0] ?? data.fullName;
  const lastName = parts.slice(1).join(' ') || '-';
  // Check email uniqueness
  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1', [data.email]
  );
  if (existing.length) throw new HttpError(409, 'Ya existe una cuenta con ese correo.');
  const hash = await bcrypt.hash(data.password, 12);
  let result;
  let clientRole: 'CLIENT' | 'STAFF' = 'CLIENT';
  try {
    const [r] = await pool.execute<ResultSetHeader>(
      "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'CLIENT')",
      [data.fullName, data.email, hash]
    );
    result = r;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : '';
    if (code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'Ya existe una cuenta con ese correo.');
    }
    if (code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || code === 'ER_BAD_FIELD_ERROR' || msg.includes('role') || msg.includes('CLIENT')) {
      // Fallback for DBs without the CLIENT enum value (migration 006 not applied)
      clientRole = 'STAFF';
      const [r] = await pool.execute<ResultSetHeader>(
        "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'STAFF')",
        [data.fullName, data.email, hash]
      );
      result = r;
    } else {
      throw error;
    }
  }
  // Create linked customer record
  try {
    await pool.execute(
      'INSERT INTO customers (first_name, last_name, phone, email) VALUES (?, ?, ?, ?)',
      [firstName, lastName, data.phone ?? null, data.email]
    );
  } catch (err) {
    if (!(err instanceof Error && 'code' in err && err.code === 'ER_DUP_ENTRY')) throw err;
  }
  const token = jwt.sign(
    { id: Number(result.insertId), role: 'CLIENT', fullName: data.fullName, tokenVersion: 0 },
    env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.cookie('laundry_session', token, {
    httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE === 'true',
    maxAge: 8 * 60 * 60 * 1000, path: '/'
  });
  res.status(201).json({ user: { id: Number(result.insertId), fullName: data.fullName, email: data.email, role: clientRole === 'CLIENT' ? 'CLIENT' : 'STAFF', isClient: true } });
}));
api.post('/auth/logout', requireAuth, asyncRoute(async (req, res) => {
  if (req.user && req.session) {
    await revokeUserSessions(req.session.id, req.session.tokenVersion);
  }
  res.clearCookie('laundry_session', { httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE === 'true', path: '/' });
  res.status(204).end();
}));
api.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));
api.patch('/auth/profile', requireAuth, asyncRoute(async (req, res) => {
  const data = z.object({
    fullName: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(40).optional().or(z.literal('')),
    avatarUrl: z.string().trim().max(500).optional().or(z.literal(''))
  }).refine((v) => v.fullName !== undefined || v.phone !== undefined || v.avatarUrl !== undefined).parse(req.body);
  await updateOwnProfile(req.user!.id, {
    fullName: data.fullName,
    phone: data.phone === '' ? null : data.phone,
    avatarUrl: data.avatarUrl === '' ? null : data.avatarUrl
  });
  let users: RowDataPacket[];
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      'SELECT id, full_name AS fullName, email, phone, avatar_url AS avatarUrl, role, active, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
      [req.user!.id]
    );
    users = r;
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ER_BAD_FIELD_ERROR') {
      const [r] = await pool.execute<RowDataPacket[]>(
        'SELECT id, full_name AS fullName, email, role, active, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
        [req.user!.id]
      );
      users = r;
    } else {
      throw err;
    }
  }
  res.json({ user: users[0] });
}));
api.get('/auth/profile', requireAuth, asyncRoute(async (req, res) => {
  const userId = req.user!.id;
  let userRow: RowDataPacket;
  try {
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT id, full_name AS fullName, email, phone, avatar_url AS avatarUrl, role, active, token_version AS tokenVersion, last_login_at AS lastLoginAt, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!users.length) throw new HttpError(404, 'No se encontró la cuenta.');
    userRow = users[0];
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ER_BAD_FIELD_ERROR')) throw error;
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT id, full_name AS fullName, email, role, active, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!users.length) throw new HttpError(404, 'No se encontró la cuenta.');
    userRow = users[0];
  }
  const [orderRows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM orders WHERE created_by = ?', [userId]
  );
  const [paymentRows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM payments WHERE created_by = ?', [userId]
  );
  const [deliveryRows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM deliveries WHERE delivered_by = ?', [userId]
  );
  const [voidedRows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM payments WHERE created_by = ? AND voided_at IS NOT NULL', [userId]
  );
  const [recentOrders] = await pool.execute<RowDataPacket[]>(
    `SELECT id, order_code AS orderCode, status, total, received_at AS receivedAt
     FROM orders WHERE created_by = ? ORDER BY received_at DESC LIMIT 5`,
    [userId]
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    user: userRow,
    stats: {
      ordersCreated: Number(orderRows[0]?.total ?? 0),
      paymentsRegistered: Number(paymentRows[0]?.total ?? 0),
      paymentsVoided: Number(voidedRows[0]?.total ?? 0),
      deliveriesConfirmed: Number(deliveryRows[0]?.total ?? 0)
    },
    recentOrders
  });
}));

api.get('/customers', requireAuth, asyncRoute(async (req, res) => {
  const search = `%${String(req.query.search ?? '').slice(0, 100)}%`;
  const { page, pageSize, offset } = paginationFor(req.query);
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM customers
     WHERE active = 1 AND (? = '%%' OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)`,
    [search, search, search, search]
  );
  const [rows] = await pool.execute(
    `SELECT id, first_name AS firstName, last_name AS lastName, phone, address, email, active, created_at AS createdAt
     FROM customers WHERE active = 1 AND (? = '%%' OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)
     ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [search, search, search, search, pageSize, offset]
  );
  res.json(pageResult(rows, countRows[0]?.total ?? 0, page, pageSize));
}));
api.get('/customers/:id', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, first_name AS firstName, last_name AS lastName, phone, address, email, active, created_at AS createdAt FROM customers WHERE id = ? AND active = 1',
    [positiveId.parse(req.params.id)]
  );
  if (!rows.length) return res.status(404).json({ error: 'No se encontró el cliente.' });
  return res.json(rows[0]);
}));
api.get('/customers/:id/history', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const [customers] = await pool.execute<RowDataPacket[]>(
    'SELECT id, first_name AS firstName, last_name AS lastName, phone, address, email FROM customers WHERE id = ? AND active = 1',
    [id]
  );
  if (!customers.length) return res.status(404).json({ error: 'No se encontró el cliente.' });
  const [orders] = await pool.execute(
    `SELECT o.id, o.order_code AS orderCode, o.received_at AS receivedAt,
      DATE_FORMAT(o.expected_delivery_at, '%Y-%m-%dT%H:%i:%s.000Z') AS expectedDeliveryAt, o.status, o.total,
      COALESCE(SUM(CASE WHEN p.voided_at IS NULL THEN p.amount ELSE 0 END), 0) AS paid
     FROM orders o LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.customer_id = ? GROUP BY o.id ORDER BY o.received_at DESC`,
    [id]
  );
  return res.json({ customer: customers[0], orders });
}));
api.post('/customers', requireAuth, asyncRoute(async (req, res) => {
  const data = customerSchema.parse(req.body);
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO customers (first_name, last_name, phone, address, email) VALUES (?, ?, ?, ?, ?)',
    [data.firstName, data.lastName, data.phone, data.address || null, data.email || null]
  );
  res.status(201).json({ id: result.insertId, ...data });
}));
api.put('/customers/:id', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = customerSchema.parse(req.body);
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE customers SET first_name = ?, last_name = ?, phone = ?, address = ?, email = ? WHERE id = ? AND active = 1',
    [data.firstName, data.lastName, data.phone, data.address || null, data.email || null, id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'No se encontró el cliente.' });
  return res.json({ id, ...data });
}));
api.delete('/customers/:id', requireAuth, asyncRoute(async (req, res) => {
  const [result] = await pool.execute<ResultSetHeader>('UPDATE customers SET active = 0 WHERE id = ?', [positiveId.parse(req.params.id)]);
  if (!result.affectedRows) return res.status(404).json({ error: 'No se encontró el cliente.' });
  return res.status(204).end();
}));

api.get('/garments', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute('SELECT id, name, description FROM garment_types WHERE active = 1 ORDER BY name');
  res.json(rows);
}));
api.post('/garments', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const data = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(255).optional() }).parse(req.body);
  const [result] = await pool.execute<ResultSetHeader>('INSERT INTO garment_types (name, description) VALUES (?, ?)', [data.name, data.description ?? null]);
  res.status(201).json({ id: result.insertId, ...data });
}));
api.put('/garments/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(255).optional() }).parse(req.body);
  const [result] = await pool.execute<ResultSetHeader>('UPDATE garment_types SET name = ?, description = ? WHERE id = ? AND active = 1', [data.name, data.description ?? null, id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'No se encontró el tipo de prenda.' });
  return res.json({ id, ...data });
}));
api.get('/services', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute('SELECT id, name, description, unit_type AS unitType, base_price AS basePrice FROM services WHERE active = 1 ORDER BY name');
  res.json(rows);
}));
api.post('/services', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const data = z.object({
    name: z.string().trim().min(1).max(100), description: z.string().max(255).optional(),
    unitType: z.enum(['PRENDA', 'KILOGRAMO', 'FIJO']), basePrice: z.number().nonnegative()
  }).parse(req.body);
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO services (name, description, unit_type, base_price) VALUES (?, ?, ?, ?)',
    [data.name, data.description ?? null, data.unitType, data.basePrice]
  );
  res.status(201).json({ id: result.insertId, ...data });
}));
api.put('/services/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = z.object({
    name: z.string().trim().min(1).max(100), description: z.string().max(255).optional(),
    unitType: z.enum(['PRENDA', 'KILOGRAMO', 'FIJO']), basePrice: z.number().nonnegative()
  }).parse(req.body);
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE services SET name = ?, description = ?, unit_type = ?, base_price = ? WHERE id = ? AND active = 1',
    [data.name, data.description ?? null, data.unitType, data.basePrice, id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'No se encontró el servicio.' });
  return res.json({ id, ...data });
}));

api.get('/orders', requireAuth, asyncRoute(async (req, res) => {
  const status = req.query.status === undefined
    ? undefined
    : z.enum(['RECIBIDO', 'EN_PROCESO', 'TERMINADO', 'ENTREGADO', 'CANCELADO']).parse(req.query.status);
  const search = `%${String(req.query.search ?? '').slice(0, 100)}%`;
  const { page, pageSize, offset } = paginationFor(req.query);
  const filters = `(? IS NULL OR o.status = ?) AND
    (? = '%%' OR o.order_code LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR o.status LIKE ?)`;
  const filterValues = [status ?? null, status ?? null, search, search, search, search, search];
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE ${filters}`,
    filterValues
  );
  const [rows] = await pool.execute(
    `SELECT o.id, o.order_code AS orderCode, o.customer_id AS customerId,
      CONCAT(c.first_name, ' ', c.last_name) AS customerName, o.received_at AS receivedAt,
      DATE_FORMAT(o.expected_delivery_at, '%Y-%m-%dT%H:%i:%s.000Z') AS expectedDeliveryAt,
      o.status, o.subtotal, o.discount, o.total,
      COALESCE(SUM(CASE WHEN p.voided_at IS NULL THEN p.amount ELSE 0 END), 0) AS paid
     FROM orders o JOIN customers c ON c.id = o.customer_id
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE ${filters}
     GROUP BY o.id ORDER BY o.received_at DESC, o.id DESC LIMIT ? OFFSET ?`,
    [...filterValues, pageSize, offset]
  );
  res.json(pageResult(rows, countRows[0]?.total ?? 0, page, pageSize));
}));
api.put('/orders/:id', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = z.object({
    expectedDeliveryAt: z.string().datetime(),
    notes: z.string().max(1000).optional()
  }).parse(req.body);
  const expectedDeliveryAt = toMySqlUtcDateTime(data.expectedDeliveryAt);
  const [result] = data.notes === undefined
    ? await pool.execute<ResultSetHeader>(
      'UPDATE orders SET expected_delivery_at = ? WHERE id = ? AND status NOT IN (?, ?)',
      [expectedDeliveryAt, id, 'ENTREGADO', 'CANCELADO']
    )
    : await pool.execute<ResultSetHeader>(
      'UPDATE orders SET expected_delivery_at = ?, notes = ? WHERE id = ? AND status NOT IN (?, ?)',
      [expectedDeliveryAt, data.notes, id, 'ENTREGADO', 'CANCELADO']
    );
  if (!result.affectedRows) {
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT status FROM orders WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'No se encontró el pedido.' });
    if (existing[0].status === 'ENTREGADO' || existing[0].status === 'CANCELADO') {
      return res.status(409).json({ error: 'No se puede modificar un pedido entregado o cancelado.' });
    }
  }
  return res.json({ id, ...data });
}));
api.get('/orders/:id', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const [orders] = await pool.execute<RowDataPacket[]>(
    `SELECT o.*, o.order_code AS orderCode,
      DATE_FORMAT(o.expected_delivery_at, '%Y-%m-%dT%H:%i:%s.000Z') AS expectedDeliveryAt,
      CONCAT(c.first_name, ' ', c.last_name) AS customerName,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id AND p.voided_at IS NULL), 0) AS paid
     FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`, [id]
  );
  if (!orders.length) return res.status(404).json({ error: 'No se encontró el pedido.' });
  const [items] = await pool.execute('SELECT i.*, g.name AS garmentName, s.name AS serviceName FROM order_items i JOIN garment_types g ON g.id=i.garment_type_id JOIN services s ON s.id=i.service_id WHERE i.order_id = ?', [id]);
  const [payments] = await pool.execute('SELECT id, amount, payment_method AS paymentMethod, reference, paid_at AS paidAt FROM payments WHERE order_id = ? AND voided_at IS NULL ORDER BY paid_at DESC', [id]);
  const [history] = await pool.execute('SELECT previous_status AS previousStatus, new_status AS newStatus, changed_at AS changedAt FROM order_status_history WHERE order_id = ? ORDER BY changed_at', [id]);
  return res.json({ ...orders[0], items, payments, history });
}));
api.post('/orders', requireAuth, asyncRoute(async (req, res) => {
  const data = z.object({
    customerId: z.number().int().positive(), expectedDeliveryAt: z.string().datetime(),
    discount: z.number().nonnegative().default(0), notes: z.string().max(1000).optional(),
    initialPayment: z.number().nonnegative().optional(),
    initialPaymentMethod: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR']).optional(),
    items: z.array(z.object({
      garmentTypeId: z.number().int().positive(), serviceId: z.number().int().positive(),
      quantity: z.number().positive(), weightKg: z.number().positive().optional(), notes: z.string().max(255).optional()
    })).min(1)
  }).parse(req.body);
  const order = await createOrder({
    ...data,
    expectedDeliveryAt: toMySqlUtcDateTime(data.expectedDeliveryAt),
    createdBy: req.user!.id
  });
  res.status(201).json(order);
}));
api.patch('/orders/:id/status', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const { status } = z.object({ status: z.enum(['EN_PROCESO', 'TERMINADO', 'CANCELADO']) }).parse(req.body);
  await updateOrderStatus(id, status, req.user!.id);
  res.json({ id, status });
}));
api.post('/orders/:id/payments', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = z.object({
    amount: z.number().positive(), paymentMethod: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR']),
    reference: z.string().max(120).optional()
  }).parse(req.body);
  await registerPayment(id, data.amount, data.paymentMethod, data.reference, req.user!.id);
  res.status(201).json({ message: 'Pago registrado.' });
}));
api.patch('/payments/:id/void', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  await voidPayment(positiveId.parse(req.params.id), req.user!.id);
  res.json({ message: 'Pago anulado y conservado en el historial.' });
}));
api.get('/orders/:id/payments', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, amount, payment_method AS paymentMethod, reference, paid_at AS paidAt FROM payments WHERE order_id = ? AND voided_at IS NULL ORDER BY paid_at DESC',
    [positiveId.parse(req.params.id)]
  );
  res.json(rows);
}));
api.post('/orders/:id/deliver', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const { receivedByName } = z.object({ receivedByName: z.string().trim().min(1).max(120) }).parse(req.body);
  await deliverOrder(id, receivedByName, req.user!.id);
  res.json({ id, status: 'ENTREGADO' });
}));

api.get('/payments', requireAuth, asyncRoute(async (req, res) => {
  const { page, pageSize, offset } = paginationFor(req.query);
  const [countRows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM payments');
  const [rows] = await pool.execute(
    `SELECT p.id, p.amount, p.payment_method AS paymentMethod, p.paid_at AS paidAt,
      p.voided_at AS voidedAt,
      o.order_code AS orderCode, CONCAT(c.first_name, ' ', c.last_name) AS customerName
     FROM payments p JOIN orders o ON o.id = p.order_id JOIN customers c ON c.id = o.customer_id
     ORDER BY p.paid_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  res.json(pageResult(rows, countRows[0]?.total ?? 0, page, pageSize));
}));
api.get('/deliveries', requireAuth, asyncRoute(async (req, res) => {
  const { page, pageSize, offset } = paginationFor(req.query);
  const [countRows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM deliveries');
  const [rows] = await pool.execute(
    `SELECT d.id, d.delivered_at AS deliveredAt, d.received_by_name AS receivedByName,
      o.order_code AS orderCode, CONCAT(c.first_name, ' ', c.last_name) AS customerName
     FROM deliveries d JOIN orders o ON o.id=d.order_id JOIN customers c ON c.id=o.customer_id
     ORDER BY d.delivered_at DESC, d.id DESC LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  res.json(pageResult(rows, countRows[0]?.total ?? 0, page, pageSize));
}));

api.get('/dashboard/summary', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS orderCount,
      SUM(status = 'RECIBIDO') AS pendingCount,
      SUM(status = 'EN_PROCESO') AS processingCount,
      SUM(status = 'TERMINADO') AS readyCount,
      SUM(status = 'ENTREGADO') AS deliveredCount
     FROM orders WHERE DATE(received_at) = CURRENT_DATE()`
  );
  const [money] = await pool.execute<RowDataPacket[]>(
    `SELECT
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN orders o ON o.id=p.order_id
       WHERE p.voided_at IS NULL AND o.status <> 'CANCELADO'
         AND p.paid_at >= CURRENT_DATE() - INTERVAL 29 DAY) AS collected,
      (SELECT COALESCE(SUM(total),0) FROM orders WHERE status <> 'CANCELADO') -
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN orders o ON o.id=p.order_id
       WHERE p.voided_at IS NULL AND o.status <> 'CANCELADO') AS balance`
  );
  const [recent] = await pool.execute(
    `SELECT o.id, o.order_code AS orderCode, CONCAT(c.first_name,' ',c.last_name) AS customerName,
      o.status, o.total,
      DATE_FORMAT(o.expected_delivery_at, '%Y-%m-%dT%H:%i:%s.000Z') AS expectedDeliveryAt
     FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.received_at DESC LIMIT 8`
  );
  res.json({ ...(rows[0] ?? {}), ...(money[0] ?? {}), recent });
}));
api.get('/reports/sales', requireAuth, asyncRoute(async (req, res) => {
  const from = z.string().date().parse(req.query.from);
  const to = z.string().date().parse(req.query.to);
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(p.paid_at, '%Y-%m-%d') AS date, SUM(p.amount) AS total, COUNT(*) AS payments
     FROM payments p JOIN orders o ON o.id=p.order_id
     WHERE p.voided_at IS NULL AND o.status <> 'CANCELADO' AND DATE(p.paid_at) BETWEEN ? AND ?
     GROUP BY DATE(p.paid_at) ORDER BY date`, [from, to]
  );
  res.json(rows);
}));
api.get('/reports/orders', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute('SELECT status, COUNT(*) AS count, SUM(total) AS total FROM orders GROUP BY status ORDER BY status');
  res.json(rows);
}));

// ---------- Portal del cliente ----------
api.get('/client/summary', requireAuth, requireClient, asyncRoute(async (req, res) => {
  const [u] = await pool.execute<RowDataPacket[]>('SELECT email FROM users WHERE id = ? LIMIT 1', [req.user!.id]);
  const email = u[0]?.email;
  const [c] = await pool.execute<RowDataPacket[]>('SELECT id FROM customers WHERE email = ? LIMIT 1', [email]);
  const customerId = c[0]?.id;
  const [orders] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS total, COALESCE(SUM(total),0) AS totalAmount, MAX(received_at) AS lastOrderAt FROM orders WHERE customer_id = ?', [customerId ?? 0]
  );
  const [pending] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM orders WHERE customer_id = ? AND status IN ('RECIBIDO','EN_PROCESO','TERMINADO')", [customerId ?? 0]
  );
  const [delivered] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM orders WHERE customer_id = ? AND status = 'ENTREGADO'", [customerId ?? 0]
  );
  const total = Number(orders[0]?.total ?? 0);
  const totalAmount = Number(orders[0]?.totalAmount ?? 0);
  res.json({
    customerId,
    orderCount: total,
    totalSpent: totalAmount,
    averageOrderValue: total > 0 ? Math.round((totalAmount / total) * 100) / 100 : 0,
    lastOrderAt: orders[0]?.lastOrderAt ?? null,
    pendingCount: Number(pending[0]?.total ?? 0),
    deliveredCount: Number(delivered[0]?.total ?? 0)
  });
}));

api.get('/client/orders', requireAuth, requireClient, asyncRoute(async (req, res) => {
  const [u] = await pool.execute<RowDataPacket[]>('SELECT email FROM users WHERE id = ? LIMIT 1', [req.user!.id]);
  const email = u[0]?.email;
  const [c] = await pool.execute<RowDataPacket[]>('SELECT id FROM customers WHERE email = ? LIMIT 1', [email]);
  const customerId = c[0]?.id;
  if (!customerId) return res.json([]);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT o.id, o.order_code AS orderCode, o.status, o.total,
            DATE_FORMAT(o.expected_delivery_at, '%Y-%m-%dT%H:%i:%s.000Z') AS expectedDeliveryAt,
            o.received_at AS receivedAt,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.id AND p.voided_at IS NULL),0) AS paid
     FROM orders o WHERE o.customer_id = ? ORDER BY o.received_at DESC`,
    [customerId]
  );
  res.json(rows);
}));

api.get('/client/shops', requireAuth, requireClient, asyncRoute(async (req, res) => {
  const lat = z.coerce.number().optional().parse(req.query.lat);
  const lng = z.coerce.number().optional().parse(req.query.lng);
  let rows: RowDataPacket[];
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, address, phone, latitude, longitude, opening_hours AS openingHours, rating, services_summary AS servicesSummary FROM laundry_shops WHERE active = 1'
    );
    rows = r;
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'ER_NO_SUCH_TABLE') {
      // Fallback sample shops when migration 006 is not applied
      const sample = [
        { id: 1, name: 'Lavandería Central', address: 'Av. 16 de Julio 1234, La Paz', phone: '+591 70000001', latitude: -16.495, longitude: -68.133, openingHours: 'Lun-Sáb 8:00-20:00', rating: 4.8, servicesSummary: 'Lavado, planchado y tintorería', imageUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=600&q=80', detergents: ['Ariel', 'Ace', 'Suavitel', 'Ecológico'], reviews: [{ author: 'María L.', rating: 5, comment: 'Excelente servicio, ropa impecable y puntual.', date: '2026-11-10' }, { author: 'Carlos R.', rating: 4, comment: 'Buen precio y atención rápida.', date: '2026-11-05' }] },
        { id: 2, name: 'Express Wash', address: 'Calle Comercio 567, La Paz', phone: '+591 70000002', latitude: -16.498, longitude: -68.138, openingHours: 'Lun-Dom 7:00-22:00', rating: 4.6, servicesSummary: 'Lavado express y delivery', imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=600&q=80', detergents: ['Ariel', 'Omo', 'Downy'], reviews: [{ author: 'Ana P.', rating: 5, comment: 'El delivery es súper rápido.', date: '2026-11-12' }] },
        { id: 3, name: 'Limpio & Seco', address: 'Av. Arce 890, La Paz', phone: '+591 70000003', latitude: -16.502, longitude: -68.128, openingHours: 'Lun-Vie 9:00-19:00', rating: 4.7, servicesSummary: 'Lavado por kilo y prendas delicadas', imageUrl: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=600&q=80', detergents: ['Persil', 'Woolite', 'Suavitel'], reviews: [{ author: 'Luis M.', rating: 4, comment: 'Cuidan muy bien la ropa delicada.', date: '2026-11-08' }] },
        { id: 4, name: 'Eco Lavandería', address: 'Zona Sur, Calle 21 456, La Paz', phone: '+591 70000004', latitude: -16.54, longitude: -68.09, openingHours: 'Lun-Sáb 8:30-18:30', rating: 4.9, servicesSummary: 'Productos ecológicos y cuidado premium', imageUrl: 'https://images.unsplash.com/photo-1489274495757-95c7c837b101?w=600&q=80', detergents: ['Ecológico', 'Hipoalergénico', 'Biolavable'], reviews: [{ author: 'Sofía T.', rating: 5, comment: 'Productos naturales, ideal para pieles sensibles.', date: '2026-11-14' }, { author: 'Diego F.', rating: 5, comment: 'La mejor de la zona.', date: '2026-11-09' }] },
        { id: 5, name: 'Aqua Clean', address: 'El Alto, Av. 6 de Marzo 321', phone: '+591 70000005', latitude: -16.51, longitude: -68.18, openingHours: 'Lun-Dom 6:00-21:00', rating: 4.5, servicesSummary: 'Servicio 24h y secado rápido', imageUrl: 'https://images.unsplash.com/photo-1521656693074-61cd59399954?w=600&q=80', detergents: ['Ariel', 'Ace', 'Secado rápido'], reviews: [{ author: 'Pedro G.', rating: 4, comment: 'Abierto siempre, muy conveniente.', date: '2026-11-07' }] }
      ];
      const lat = z.coerce.number().optional().parse(req.query.lat);
      const lng = z.coerce.number().optional().parse(req.query.lng);
      const shops = sample.map((s) => {
        let distance: number | null = null;
        if (lat !== undefined && lng !== undefined) {
          const R = 6371;
          const dLat = ((s.latitude - lat) * Math.PI) / 180;
          const dLng = ((s.longitude - lng) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((s.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
          distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        return { ...s, distance: distance !== null ? Math.round(distance * 10) / 10 : null };
      });
      shops.sort((a, b) => { if (a.distance === null) return 1; if (b.distance === null) return -1; return a.distance - b.distance; });
      res.json(shops);
      return;
    }
    throw err;
  }
  const shops = rows.map((s) => {
    let distance: number | null = null;
    if (lat !== undefined && lng !== undefined) {
      const R = 6371;
      const dLat = ((Number(s.latitude) - lat) * Math.PI) / 180;
      const dLng = ((Number(s.longitude) - lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) * Math.cos((Number(s.latitude) * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
      distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return { ...s, distance: distance !== null ? Math.round(distance * 10) / 10 : null };
  });
  shops.sort((a, b) => {
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });
  res.json(shops);
}));

// Detalle de una lavandería + reseñas
api.get('/client/shops/:id', requireAuth, requireClient, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, address, phone, latitude, longitude, opening_hours AS openingHours, rating, services_summary AS servicesSummary, image_url AS imageUrl, detergents FROM laundry_shops WHERE id = ? AND active = 1 LIMIT 1',
      [id]
    );
    if (!rows.length) throw new HttpError(404, 'No se encontró la lavandería.');
    const shop = rows[0] as Record<string, unknown>;
    let reviews: RowDataPacket[] = [];
    try {
      const [r] = await pool.execute<RowDataPacket[]>(
        `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt, u.full_name AS author
         FROM shop_reviews r JOIN users u ON u.id = r.user_id
         WHERE r.shop_id = ? ORDER BY r.created_at DESC LIMIT 20`,
        [id]
      );
      reviews = r;
    } catch { /* table may not exist */ }
    res.json({ ...shop, detergents: shop.detergents ? String(shop.detergents).split(',').map((s) => s.trim()).filter(Boolean) : [], reviews });
    return;
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code !== 'ER_NO_SUCH_TABLE' && code !== 'ER_BAD_FIELD_ERROR') throw err;
  }
  // Fallback sample
  const sample = [
    { id: 1, name: 'Lavandería Central', address: 'Av. 16 de Julio 1234, La Paz', phone: '+591 70000001', latitude: -16.495, longitude: -68.133, openingHours: 'Lun-Sáb 8:00-20:00', rating: 4.8, servicesSummary: 'Lavado, planchado y tintorería', imageUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=600&q=80', detergents: ['Ariel', 'Ace', 'Suavitel', 'Ecológico'], reviews: [{ id: 1, author: 'María L.', rating: 5, comment: 'Excelente servicio, ropa impecable y puntual.', createdAt: '2026-11-10' }, { id: 2, author: 'Carlos R.', rating: 4, comment: 'Buen precio y atención rápida.', createdAt: '2026-11-05' }] },
    { id: 2, name: 'Express Wash', address: 'Calle Comercio 567, La Paz', phone: '+591 70000002', latitude: -16.498, longitude: -68.138, openingHours: 'Lun-Dom 7:00-22:00', rating: 4.6, servicesSummary: 'Lavado express y delivery', imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=600&q=80', detergents: ['Ariel', 'Omo', 'Downy'], reviews: [{ id: 3, author: 'Ana P.', rating: 5, comment: 'El delivery es súper rápido.', createdAt: '2026-11-12' }] },
    { id: 3, name: 'Limpio & Seco', address: 'Av. Arce 890, La Paz', phone: '+591 70000003', latitude: -16.502, longitude: -68.128, openingHours: 'Lun-Vie 9:00-19:00', rating: 4.7, servicesSummary: 'Lavado por kilo y prendas delicadas', imageUrl: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=600&q=80', detergents: ['Persil', 'Woolite', 'Suavitel'], reviews: [{ id: 4, author: 'Luis M.', rating: 4, comment: 'Cuidan muy bien la ropa delicada.', createdAt: '2026-11-08' }] },
    { id: 4, name: 'Eco Lavandería', address: 'Zona Sur, Calle 21 456, La Paz', phone: '+591 70000004', latitude: -16.54, longitude: -68.09, openingHours: 'Lun-Sáb 8:30-18:30', rating: 4.9, servicesSummary: 'Productos ecológicos y cuidado premium', imageUrl: 'https://images.unsplash.com/photo-1489274495757-95c7c837b101?w=600&q=80', detergents: ['Ecológico', 'Hipoalergénico', 'Biolavable'], reviews: [{ id: 5, author: 'Sofía T.', rating: 5, comment: 'Productos naturales, ideal para pieles sensibles.', createdAt: '2026-11-14' }, { id: 6, author: 'Diego F.', rating: 5, comment: 'La mejor de la zona.', createdAt: '2026-11-09' }] },
    { id: 5, name: 'Aqua Clean', address: 'El Alto, Av. 6 de Marzo 321', phone: '+591 70000005', latitude: -16.51, longitude: -68.18, openingHours: 'Lun-Dom 6:00-21:00', rating: 4.5, servicesSummary: 'Servicio 24h y secado rápido', imageUrl: 'https://images.unsplash.com/photo-1521656693074-61cd59399954?w=600&q=80', detergents: ['Ariel', 'Ace', 'Secado rápido'], reviews: [{ id: 7, author: 'Pedro G.', rating: 4, comment: 'Abierto siempre, muy conveniente.', createdAt: '2026-11-07' }] }
  ];
  const shop = sample.find((s) => s.id === id);
  if (!shop) throw new HttpError(404, 'No se encontró la lavandería.');
  res.json(shop);
}));

api.post('/client/shops/:id/reviews', requireAuth, requireClient, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).parse(req.body);
  try {
    await pool.execute(
      'INSERT INTO shop_reviews (shop_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
      [id, req.user!.id, data.rating, data.comment ?? null]
    );
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code !== 'ER_NO_SUCH_TABLE') throw err;
  }
  res.status(201).json({ message: 'Reseña registrada.' });
}));

// ---------- Favoritos ----------
api.get('/client/favorites', requireAuth, requireClient, asyncRoute(async (req, res) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.id, s.name, s.address, s.phone, s.latitude, s.longitude, s.opening_hours AS openingHours,
              s.rating, s.services_summary AS servicesSummary, s.image_url AS imageUrl, s.detergents
       FROM user_favorites f JOIN laundry_shops s ON s.id = f.shop_id
       WHERE f.user_id = ? AND s.active = 1`,
      [req.user!.id]
    );
    res.json(rows.map((r) => ({ ...r, detergents: r.detergents ? String(r.detergents).split(',').map((s: string) => s.trim()).filter(Boolean) : [] })));
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'ER_NO_SUCH_TABLE') { res.json([]); return; }
    throw err;
  }
}));
api.post('/client/favorites/:id', requireAuth, requireClient, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  try {
    await pool.execute('INSERT IGNORE INTO user_favorites (user_id, shop_id) VALUES (?, ?)', [req.user!.id, id]);
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code !== 'ER_NO_SUCH_TABLE') throw err;
  }
  res.status(201).json({ message: 'Agregado a favoritos.' });
}));
api.delete('/client/favorites/:id', requireAuth, requireClient, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  try {
    await pool.execute('DELETE FROM user_favorites WHERE user_id = ? AND shop_id = ?', [req.user!.id, id]);
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code !== 'ER_NO_SUCH_TABLE') throw err;
  }
  res.status(204).end();
}));

// ---------- Turnos / reservas ----------
api.get('/client/bookings', requireAuth, requireClient, asyncRoute(async (req, res) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT b.id, b.shop_id AS shopId, s.name AS shopName, b.service, b.scheduled_at AS scheduledAt,
              b.status, b.notes, b.created_at AS createdAt
       FROM shop_bookings b JOIN laundry_shops s ON s.id = b.shop_id
       WHERE b.user_id = ? ORDER BY b.scheduled_at DESC`,
      [req.user!.id]
    );
    res.json(rows);
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'ER_NO_SUCH_TABLE') { res.json([]); return; }
    throw err;
  }
}));
api.post('/client/bookings', requireAuth, requireClient, asyncRoute(async (req, res) => {
  const data = z.object({
    shopId: z.number().int().positive(),
    service: z.string().trim().min(1).max(80),
    scheduledAt: z.string().datetime(),
    notes: z.string().trim().max(500).optional()
  }).parse(req.body);
  try {
    const [r] = await pool.execute<ResultSetHeader>(
      'INSERT INTO shop_bookings (shop_id, user_id, service, scheduled_at, notes) VALUES (?, ?, ?, ?, ?)',
      [data.shopId, req.user!.id, data.service, toMySqlUtcDateTime(data.scheduledAt), data.notes ?? null]
    );
    res.status(201).json({ id: r.insertId, message: 'Turno reservado.' });
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'ER_NO_SUCH_TABLE') {
      res.status(201).json({ id: Date.now(), message: 'Turno reservado (modo demo).' });
      return;
    }
    throw err;
  }
}));

// ---------- Chat con la lavandería ----------
api.get('/client/shops/:id/messages', requireAuth, requireClient, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT m.id, m.sender, m.message, m.created_at AS createdAt, u.full_name AS author
       FROM shop_messages m JOIN users u ON u.id = m.user_id
       WHERE m.shop_id = ? ORDER BY m.created_at ASC LIMIT 50`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'ER_NO_SUCH_TABLE') { res.json([]); return; }
    throw err;
  }
}));
api.post('/client/shops/:id/messages', requireAuth, requireClient, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = z.object({ message: z.string().trim().min(1).max(1000) }).parse(req.body);
  try {
    await pool.execute(
      'INSERT INTO shop_messages (shop_id, user_id, sender, message) VALUES (?, ?, ?, ?)',
      [id, req.user!.id, 'CLIENTE', data.message]
    );
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code !== 'ER_NO_SUCH_TABLE') throw err;
  }
  res.status(201).json({ message: 'Mensaje enviado.' });
}));

api.get('/users', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, full_name AS fullName, email, role, active, created_at AS createdAt FROM users ORDER BY full_name'
  );
  res.json(rows);
}));
api.post('/users', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const data = z.object({ fullName: z.string().trim().min(1).max(120), email: z.string().email(), password: z.string().min(12).max(200), role: z.enum(['ADMIN', 'STAFF']) }).parse(req.body);
  const hash = await bcrypt.hash(data.password, 12);
  const [result] = await pool.execute<ResultSetHeader>('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)', [data.fullName, data.email, hash, data.role]);
  res.status(201).json({ id: result.insertId, fullName: data.fullName, email: data.email, role: data.role, active: true });
}));
api.patch('/users/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = z.object({
    role: z.enum(['ADMIN', 'STAFF']).optional(),
    active: z.boolean().optional()
  }).refine(value => value.role !== undefined || value.active !== undefined).parse(req.body);
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [admins] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM users WHERE active = 1 AND role = 'ADMIN' FOR UPDATE"
    );
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT id, role, active FROM users WHERE id = ? FOR UPDATE', [id]
    );
    if (!rows.length) throw new HttpError(404, 'No se encontró el usuario.');
    const target = rows[0];
    const role = data.role ?? target.role;
    const active = data.active ?? Boolean(target.active);
    if (id === req.user!.id && (role !== 'ADMIN' || !active)) {
      throw new HttpError(409, 'No puedes quitarte tus propios permisos de administrador ni desactivar tu cuenta.');
    }
    if (target.role === 'ADMIN' && Boolean(target.active) && (role !== 'ADMIN' || !active) && admins.length <= 1) {
      throw new HttpError(409, 'Debe permanecer al menos un administrador activo.');
    }
    const permissionsChanged = role !== target.role || active !== Boolean(target.active);
    await connection.execute(
      'UPDATE users SET role = ?, active = ?, token_version = token_version + ? WHERE id = ?',
      [role, active, permissionsChanged ? 1 : 0, id]
    );
    await connection.commit();
    transactionStarted = false;
    return res.json({ id, role, active });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));
api.patch('/users/:id/password', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  if (id === req.user!.id) {
    throw new HttpError(409, 'Usa el cambio de contraseña de tu propia cuenta para actualizarla.');
  }
  const { password } = z.object({ password: z.string().min(12).max(200) }).parse(req.body);
  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
    [hash, id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'No se encontró el usuario.' });
  return res.json({ message: 'Contraseña restablecida. Las sesiones anteriores fueron cerradas.' });
}));
