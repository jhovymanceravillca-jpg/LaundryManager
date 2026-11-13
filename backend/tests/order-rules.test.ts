import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLineTotal, canTransitionOrder } from '../src/services/order-rules';
import { toMySqlUtcDateTime } from '../src/utils/datetime';

test('calculates per-garment, per-kilogram, and fixed service totals', () => {
  assert.equal(calculateLineTotal('PRENDA', 5, 3), 15);
  assert.equal(calculateLineTotal('KILOGRAMO', 10, 1, 2.5), 25);
  assert.equal(calculateLineTotal('FIJO', 15, 4), 15);
});

test('rounds monetary line amounts to cents', () => {
  assert.equal(calculateLineTotal('KILOGRAMO', 7.25, 1, 1.333), 9.66);
});

test('rejects invalid quantities, prices, and missing kilogram weight', () => {
  assert.throws(() => calculateLineTotal('PRENDA', 5, 0), /cantidad/);
  assert.throws(() => calculateLineTotal('PRENDA', -1, 1), /precio/);
  assert.throws(() => calculateLineTotal('KILOGRAMO', 10, 1), /peso/);
});

test('allows only documented order state transitions', () => {
  assert.equal(canTransitionOrder('RECIBIDO', 'EN_PROCESO'), true);
  assert.equal(canTransitionOrder('EN_PROCESO', 'TERMINADO'), true);
  assert.equal(canTransitionOrder('TERMINADO', 'ENTREGADO'), false);
  assert.equal(canTransitionOrder('ENTREGADO', 'EN_PROCESO'), false);
  assert.equal(canTransitionOrder('CANCELADO', 'RECIBIDO'), false);
});

test('converts ISO UTC dates to MySQL DATETIME without timezone suffix', () => {
  assert.equal(toMySqlUtcDateTime('2026-11-14T16:00:00.000Z'), '2026-11-14 16:00:00');
  assert.equal(toMySqlUtcDateTime('2026-11-14T12:00:00-04:00'), '2026-11-14 16:00:00');
  assert.throws(() => toMySqlUtcDateTime('invalid'), /Fecha y hora no válidas/);
});
