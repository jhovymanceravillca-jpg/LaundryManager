import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { pool } from '../config/database';
import { HttpError } from '../utils/http-error';
import { calculateLineTotal, canTransitionOrder } from './order-rules';

type ItemInput = { garmentTypeId: number; serviceId: number; quantity: number; weightKg?: number; notes?: string };

export async function createOrder(input: {
  customerId: number; createdBy: number; expectedDeliveryAt: string; discount: number;
  notes?: string; items: ItemInput[]; initialPayment?: number;
  initialPaymentMethod?: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'QR';
}) {
  if (!input.items.length) throw new HttpError(400, 'Agrega al menos una prenda al pedido.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [customer] = await connection.execute<RowDataPacket[]>('SELECT id FROM customers WHERE id = ? AND active = 1', [input.customerId]);
    if (!customer.length) throw new HttpError(404, 'No se encontró el cliente.');

    let subtotal = 0;
    const lines: Array<{ item: ItemInput; unitPrice: number; lineTotal: number }> = [];
    for (const item of input.items) {
      const [serviceRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id, unit_type AS unitType, base_price AS basePrice FROM services WHERE id = ? AND active = 1', [item.serviceId]
      );
      if (!serviceRows.length) throw new HttpError(400, 'Uno de los servicios no está disponible.');
      const service = serviceRows[0];
      const [garmentRows] = await connection.execute<RowDataPacket[]>('SELECT id FROM garment_types WHERE id = ? AND active = 1', [item.garmentTypeId]);
      if (!garmentRows.length) throw new HttpError(400, 'Uno de los tipos de prenda no está disponible.');
      const unitPrice = Number(service.basePrice);
      const lineTotal = calculateLineTotal(service.unitType, unitPrice, item.quantity, item.weightKg);
      subtotal += lineTotal;
      lines.push({ item, unitPrice, lineTotal });
    }
    if (input.discount < 0 || input.discount > subtotal) throw new HttpError(400, 'El descuento no puede superar el subtotal.');

    const code = `PED-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const total = Math.round((subtotal - input.discount) * 100) / 100;
    const initialPayment = input.initialPayment ?? 0;
    if (initialPayment < 0 || initialPayment > total) {
      throw new HttpError(400, 'El pago inicial debe ser positivo y no superar el total del pedido.');
    }
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO orders (order_code, customer_id, created_by, expected_delivery_at, subtotal, discount, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [code, input.customerId, input.createdBy, input.expectedDeliveryAt, subtotal, input.discount, total, input.notes ?? null]
    );
    for (const { item, unitPrice, lineTotal } of lines) {
      await connection.execute(
        'INSERT INTO order_items (order_id, garment_type_id, service_id, quantity, weight_kg, unit_price, subtotal, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [result.insertId, item.garmentTypeId, item.serviceId, item.quantity, item.weightKg ?? null, unitPrice, lineTotal, item.notes ?? null]
      );
    }
    await connection.execute(
      'INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES (?, NULL, ?, ?)',
      [result.insertId, 'RECIBIDO', input.createdBy]
    );
    if (initialPayment > 0) {
      await connection.execute(
        'INSERT INTO payments (order_id, amount, payment_method, created_by) VALUES (?, ?, ?, ?)',
        [result.insertId, initialPayment, input.initialPaymentMethod ?? 'EFECTIVO', input.createdBy]
      );
    }
    await connection.commit();
    return { id: result.insertId, orderCode: code, subtotal, discount: input.discount, total, paid: initialPayment };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateOrderStatus(id: number, status: string, changedBy: number) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT status FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) throw new HttpError(404, 'No se encontró el pedido.');
    const previous = String(rows[0].status);
    if (!canTransitionOrder(previous, status)) throw new HttpError(409, 'Ese cambio de estado no está permitido.');
    await connection.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    await connection.execute(
      'INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES (?, ?, ?, ?)',
      [id, previous, status, changedBy]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function registerPayment(id: number, amount: number, method: string, reference: string | undefined, userId: number) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT o.total, o.status,
       COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id AND p.voided_at IS NULL), 0) AS paid
       FROM orders o WHERE o.id = ? FOR UPDATE`, [id]
    );
    if (!rows.length) throw new HttpError(404, 'No se encontró el pedido.');
    if (rows[0].status === 'CANCELADO') throw new HttpError(409, 'No se aceptan pagos para pedidos cancelados.');
    const balance = Number(rows[0].total) - Number(rows[0].paid);
    if (amount <= 0 || amount > balance) throw new HttpError(400, 'El monto debe ser positivo y no superar el saldo pendiente.');
    await connection.execute(
      'INSERT INTO payments (order_id, amount, payment_method, reference, created_by) VALUES (?, ?, ?, ?, ?)',
      [id, amount, method, reference ?? null, userId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deliverOrder(id: number, receivedByName: string, userId: number) {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT status FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) throw new HttpError(404, 'No se encontró el pedido.');
    if (rows[0].status !== 'TERMINADO') throw new HttpError(409, 'Solo se pueden entregar pedidos terminados.');
    await connection.execute('INSERT INTO deliveries (order_id, delivered_by, received_by_name) VALUES (?, ?, ?)', [id, userId, receivedByName]);
    await connection.execute('UPDATE orders SET status = ? WHERE id = ?', ['ENTREGADO', id]);
    await connection.execute(
      'INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES (?, ?, ?, ?)',
      [id, 'TERMINADO', 'ENTREGADO', userId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function voidPayment(paymentId: number, userId: number) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT id, voided_at AS voidedAt FROM payments WHERE id = ? FOR UPDATE',
      [paymentId]
    );
    if (!rows.length) throw new HttpError(404, 'No se encontró el pago.');
    if (rows[0].voidedAt) throw new HttpError(409, 'El pago ya fue anulado.');
    await connection.execute(
      'UPDATE payments SET voided_at = CURRENT_TIMESTAMP, voided_by = ? WHERE id = ?',
      [userId, paymentId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
