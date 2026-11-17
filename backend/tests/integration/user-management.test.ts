import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, test } from 'node:test';
import mysql from 'mysql2/promise';
import { app } from '../../src/app';
import { env } from '../../src/config/env';
import { pool } from '../../src/config/database';

let server: ReturnType<typeof app.listen> | undefined;
let baseUrl = '';

before(async () => {
  if (!/^laundry_manager_test(?:_[a-zA-Z0-9_]+)?$/.test(env.DB_NAME)) {
    throw new Error('Las pruebas de integración sólo pueden usar una base cuyo nombre empiece por laundry_manager_test.');
  }
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true
  });
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\`; CREATE DATABASE \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    const schema = await readFile(path.resolve(process.cwd(), '..', 'database', 'schema.sql'), 'utf8');
    await connection.query(schema.replace(/\blaundry_manager\b/g, env.DB_NAME));
  } finally {
    await connection.end();
  }

  const listeningServer = app.listen(0, '127.0.0.1');
  server = listeningServer;
  await new Promise<void>((resolve, reject) => {
    listeningServer.once('listening', resolve);
    listeningServer.once('error', reject);
  });
  const address = listeningServer.address();
  if (!address || typeof address === 'string') throw new Error('No se pudo determinar el puerto de pruebas.');
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close(error => error ? reject(error) : resolve());
    });
  }
  await pool.end();
});

async function request(pathname: string, options: {
  method?: string;
  body?: unknown;
  cookie?: string;
} = {}) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.cookie) headers.Cookie = options.cookie;
  return fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });
}

function sessionCookie(response: Response) {
  const header = response.headers.get('set-cookie');
  assert.ok(header, 'La respuesta debe crear una cookie de sesión.');
  return header.split(';', 1)[0];
}

test('admin can manage accounts and account changes revoke existing sessions', async () => {
  const setup = await request('/auth/setup', {
    method: 'POST',
    body: { fullName: 'Admin de pruebas', email: 'admin@example.test', password: 'AdminPassword123!' }
  });
  assert.equal(setup.status, 201);
  const adminCookie = sessionCookie(setup);

  const selfDeactivation = await request('/users/1', {
    method: 'PATCH',
    cookie: adminCookie,
    body: { active: false }
  });
  assert.equal(selfDeactivation.status, 409);

  const created = await request('/users', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      fullName: 'Personal de pruebas',
      email: 'staff@example.test',
      password: 'InitialPassword123!',
      role: 'STAFF'
    }
  });
  assert.equal(created.status, 201);
  const staff = await created.json() as { id: number };

  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: 'staff@example.test', password: 'InitialPassword123!' }
  });
  assert.equal(login.status, 200);
  const originalStaffCookie = sessionCookie(login);

  const reset = await request(`/users/${staff.id}/password`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { password: 'ReplacementPassword123!' }
  });
  assert.equal(reset.status, 200);
  assert.equal((await request('/auth/me', { cookie: originalStaffCookie })).status, 401);

  const newLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'staff@example.test', password: 'ReplacementPassword123!' }
  });
  assert.equal(newLogin.status, 200);
  const preRoleChangeCookie = sessionCookie(newLogin);

  const roleChange = await request(`/users/${staff.id}`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { role: 'ADMIN' }
  });
  assert.equal(roleChange.status, 200);
  assert.equal((await request('/auth/me', { cookie: preRoleChangeCookie })).status, 401);

  const deactivation = await request(`/users/${staff.id}`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { active: false }
  });
  assert.equal(deactivation.status, 200);
  assert.equal((await request('/auth/login', {
    method: 'POST',
    body: { email: 'staff@example.test', password: 'ReplacementPassword123!' }
  })).status, 401);

  const fixtureCount = 51;
  const customerValues = Array.from({ length: fixtureCount }, (_, index) => [
    `Pagination${index}`, 'Fixture', `555${String(index).padStart(7, '0')}`
  ]).flat();
  const [customerInsert] = await pool.execute<any>(
    `INSERT INTO customers (first_name, last_name, phone) VALUES ${Array(fixtureCount).fill('(?, ?, ?)').join(', ')}`,
    customerValues
  );
  const orderValues = Array.from({ length: fixtureCount }, (_, index) => [
    `PAG-${String(index).padStart(4, '0')}`,
    Number(customerInsert.insertId) + index,
    1,
    '2026-11-17 12:00:00',
    10,
    0,
    10
  ]).flat();
  const orderTuples = Array(fixtureCount).fill('(?, ?, ?, ?, ?, ?, ?)').join(', ');
  const [orderInsert] = await pool.execute<any>(
    `INSERT INTO orders (order_code, customer_id, created_by, expected_delivery_at, subtotal, discount, total) VALUES ${orderTuples}`,
    orderValues
  );
  const orderIds = Array.from({ length: fixtureCount }, (_, index) => Number(orderInsert.insertId) + index);
  const paymentValues = orderIds.flatMap(id => [id, 1, 'EFECTIVO', 1]);
  await pool.execute(
    `INSERT INTO payments (order_id, amount, payment_method, created_by) VALUES ${Array(fixtureCount).fill('(?, ?, ?, ?)').join(', ')}`,
    paymentValues
  );
  await pool.execute("UPDATE orders SET status = 'ENTREGADO' WHERE order_code LIKE 'PAG-%'");
  const deliveryValues = orderIds.flatMap(id => [id, 1, 'Cliente de prueba']);
  await pool.execute(
    `INSERT INTO deliveries (order_id, delivered_by, received_by_name) VALUES ${Array(fixtureCount).fill('(?, ?, ?)').join(', ')}`,
    deliveryValues
  );

  for (const pathname of [
    '/customers?search=Pagination',
    '/orders?search=PAG',
    '/payments',
    '/deliveries'
  ]) {
    const separator = pathname.includes('?') ? '&' : '?';
    const response = await request(`${pathname}${separator}page=2&pageSize=50`, { cookie: adminCookie });
    assert.equal(response.status, 200);
    const result = await response.json() as { items: unknown[]; page: number; pageSize: number; total: number };
    assert.equal(result.page, 2);
    assert.equal(result.pageSize, 50);
    assert.equal(result.total, fixtureCount);
    assert.equal(result.items.length, 1);
  }
});
