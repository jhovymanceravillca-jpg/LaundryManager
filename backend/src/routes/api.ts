import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/database';
import { env } from '../config/env';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { authenticate, createFirstAdmin } from '../services/auth';
import { createOrder, deliverOrder, registerPayment, updateOrderStatus, voidPayment } from '../services/orders';
import { toMySqlUtcDateTime } from '../utils/datetime';

export const api = Router();
const asyncRoute = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res)).catch(next);
const positiveId = z.coerce.number().int().positive();
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
  const [rows] = await pool.execute<any[]>(
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
  const [rows] = await pool.execute<any[]>('SELECT EXISTS(SELECT 1 FROM users LIMIT 1) AS hasAdmin');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ setupRequired: !Boolean(rows[0]?.hasAdmin) });
}));
api.post('/auth/setup', asyncRoute(async (req, res) => {
  const data = z.object({
    fullName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(190),
    password: z.string().min(12).max(200)
  }).parse(req.body);
  const result = await createFirstAdmin(data.fullName, data.email, data.password);
  res.cookie('laundry_session', result.token, {
    httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE === 'true',
    maxAge: 8 * 60 * 60 * 1000, path: '/'
  });
  res.status(201).json({ user: result.user });
}));
api.post('/auth/login', asyncRoute(async (req, res) => {
  const data = z.object({ email: z.string().email(), password: z.string().min(1).max(200) }).parse(req.body);
  const result = await authenticate(data.email, data.password);
  if (!result) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  res.cookie('laundry_session', result.token, {
    httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE === 'true',
    maxAge: 8 * 60 * 60 * 1000, path: '/'
  });
  return res.json({ user: result.user });
}));
api.post('/auth/logout', (_req, res) => {
  res.clearCookie('laundry_session', { httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE === 'true', path: '/' });
  res.status(204).end();
});
api.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

api.get('/customers', requireAuth, asyncRoute(async (req, res) => {
  const search = `%${String(req.query.search ?? '').slice(0, 100)}%`;
  const [rows] = await pool.execute(
    `SELECT id, first_name AS firstName, last_name AS lastName, phone, address, email, active, created_at AS createdAt
     FROM customers WHERE active = 1 AND (? = '%%' OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)
     ORDER BY created_at DESC LIMIT 200`,
    [search, search, search, search]
  );
  res.json(rows);
}));
api.get('/customers/:id', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute<any[]>(
    'SELECT id, first_name AS firstName, last_name AS lastName, phone, address, email, active, created_at AS createdAt FROM customers WHERE id = ? AND active = 1',
    [positiveId.parse(req.params.id)]
  );
  if (!rows.length) return res.status(404).json({ error: 'No se encontró el cliente.' });
  return res.json(rows[0]);
}));
api.get('/customers/:id/history', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const [customers] = await pool.execute<any[]>(
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
  const [result] = await pool.execute<any>(
    'INSERT INTO customers (first_name, last_name, phone, address, email) VALUES (?, ?, ?, ?, ?)',
    [data.firstName, data.lastName, data.phone, data.address || null, data.email || null]
  );
  res.status(201).json({ id: result.insertId, ...data });
}));
api.put('/customers/:id', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = customerSchema.parse(req.body);
  const [result] = await pool.execute<any>(
    'UPDATE customers SET first_name = ?, last_name = ?, phone = ?, address = ?, email = ? WHERE id = ? AND active = 1',
    [data.firstName, data.lastName, data.phone, data.address || null, data.email || null, id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'No se encontró el cliente.' });
  return res.json({ id, ...data });
}));
api.delete('/customers/:id', requireAuth, asyncRoute(async (req, res) => {
  const [result] = await pool.execute<any>('UPDATE customers SET active = 0 WHERE id = ?', [positiveId.parse(req.params.id)]);
  if (!result.affectedRows) return res.status(404).json({ error: 'No se encontró el cliente.' });
  return res.status(204).end();
}));

api.get('/garments', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute('SELECT id, name, description FROM garment_types WHERE active = 1 ORDER BY name');
  res.json(rows);
}));
api.post('/garments', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const data = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(255).optional() }).parse(req.body);
  const [result] = await pool.execute<any>('INSERT INTO garment_types (name, description) VALUES (?, ?)', [data.name, data.description ?? null]);
  res.status(201).json({ id: result.insertId, ...data });
}));
api.put('/garments/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(255).optional() }).parse(req.body);
  const [result] = await pool.execute<any>('UPDATE garment_types SET name = ?, description = ? WHERE id = ? AND active = 1', [data.name, data.description ?? null, id]);
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
  const [result] = await pool.execute<any>(
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
  const [result] = await pool.execute<any>(
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
  const [rows] = await pool.execute(
    `SELECT o.id, o.order_code AS orderCode, o.customer_id AS customerId,
      CONCAT(c.first_name, ' ', c.last_name) AS customerName, o.received_at AS receivedAt,
      DATE_FORMAT(o.expected_delivery_at, '%Y-%m-%dT%H:%i:%s.000Z') AS expectedDeliveryAt,
      o.status, o.subtotal, o.discount, o.total,
      COALESCE(SUM(CASE WHEN p.voided_at IS NULL THEN p.amount ELSE 0 END), 0) AS paid
     FROM orders o JOIN customers c ON c.id = o.customer_id
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE (? IS NULL OR o.status = ?) AND (? = '%%' OR o.order_code LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)
     GROUP BY o.id ORDER BY o.received_at DESC LIMIT 200`
    , [status ?? null, status ?? null, search, search, search, search]
  );
  res.json(rows);
}));
api.put('/orders/:id', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const data = z.object({
    expectedDeliveryAt: z.string().datetime(),
    notes: z.string().max(1000).optional()
  }).parse(req.body);
  const expectedDeliveryAt = toMySqlUtcDateTime(data.expectedDeliveryAt);
  const [result] = data.notes === undefined
    ? await pool.execute<any>(
      'UPDATE orders SET expected_delivery_at = ? WHERE id = ? AND status NOT IN (?, ?)',
      [expectedDeliveryAt, id, 'ENTREGADO', 'CANCELADO']
    )
    : await pool.execute<any>(
      'UPDATE orders SET expected_delivery_at = ?, notes = ? WHERE id = ? AND status NOT IN (?, ?)',
      [expectedDeliveryAt, data.notes, id, 'ENTREGADO', 'CANCELADO']
    );
  if (!result.affectedRows) {
    const [existing] = await pool.execute<any[]>('SELECT status FROM orders WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'No se encontró el pedido.' });
    if (existing[0].status === 'ENTREGADO' || existing[0].status === 'CANCELADO') {
      return res.status(409).json({ error: 'No se puede modificar un pedido entregado o cancelado.' });
    }
  }
  return res.json({ id, ...data });
}));
api.get('/orders/:id', requireAuth, asyncRoute(async (req, res) => {
  const id = positiveId.parse(req.params.id);
  const [orders] = await pool.execute<any[]>(
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

api.get('/payments', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute(
    `SELECT p.id, p.amount, p.payment_method AS paymentMethod, p.paid_at AS paidAt,
      p.voided_at AS voidedAt,
      o.order_code AS orderCode, CONCAT(c.first_name, ' ', c.last_name) AS customerName
     FROM payments p JOIN orders o ON o.id = p.order_id JOIN customers c ON c.id = o.customer_id
     ORDER BY p.paid_at DESC LIMIT 200`
  );
  res.json(rows);
}));
api.get('/deliveries', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute(
    `SELECT d.id, d.delivered_at AS deliveredAt, d.received_by_name AS receivedByName,
      o.order_code AS orderCode, CONCAT(c.first_name, ' ', c.last_name) AS customerName
     FROM deliveries d JOIN orders o ON o.id=d.order_id JOIN customers c ON c.id=o.customer_id
     ORDER BY d.delivered_at DESC LIMIT 200`
  );
  res.json(rows);
}));

api.get('/dashboard/summary', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute<any[]>(
    `SELECT COUNT(*) AS orderCount,
      SUM(status = 'RECIBIDO') AS pendingCount,
      SUM(status = 'EN_PROCESO') AS processingCount,
      SUM(status = 'TERMINADO') AS readyCount,
      SUM(status = 'ENTREGADO') AS deliveredCount
     FROM orders WHERE DATE(received_at) = CURRENT_DATE()`
  );
  const [money] = await pool.execute<any[]>(
    `SELECT
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN orders o ON o.id=p.order_id
       WHERE p.voided_at IS NULL AND o.status <> 'CANCELADO') AS collected,
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
    `SELECT DATE(p.paid_at) AS date, SUM(p.amount) AS total, COUNT(*) AS payments
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

api.get('/users', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, full_name AS fullName, email, role, active, created_at AS createdAt FROM users ORDER BY full_name'
  );
  res.json(rows);
}));
api.post('/users', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const data = z.object({ fullName: z.string().trim().min(1).max(120), email: z.string().email(), password: z.string().min(12).max(200), role: z.enum(['ADMIN', 'STAFF']) }).parse(req.body);
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(data.password, 12);
  const [result] = await pool.execute<any>('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)', [data.fullName, data.email, hash, data.role]);
  res.status(201).json({ id: result.insertId, fullName: data.fullName, email: data.email, role: data.role });
}));
