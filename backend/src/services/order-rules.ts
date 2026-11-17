import { HttpError } from '../utils/http-error';

export type UnitType = 'PRENDA' | 'KILOGRAMO' | 'FIJO';

export function calculateLineTotal(unitType: UnitType, basePrice: number, quantity: number, weightKg?: number) {
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new HttpError(400, 'El precio no puede ser negativo.');
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new HttpError(400, 'La cantidad debe ser mayor que cero.');
  }
  if (unitType === 'KILOGRAMO' && (!Number.isFinite(weightKg) || !weightKg || weightKg <= 0)) {
    throw new HttpError(400, 'Ingresa un peso positivo para el servicio por kilogramo.');
  }
  const units = unitType === 'KILOGRAMO' ? weightKg! : unitType === 'FIJO' ? 1 : quantity;
  return Math.round(basePrice * units * 100) / 100;
}

const transitions: Record<string, readonly string[]> = {
  RECIBIDO: ['EN_PROCESO', 'CANCELADO'],
  EN_PROCESO: ['TERMINADO', 'CANCELADO'],
  TERMINADO: ['CANCELADO'],
  ENTREGADO: [],
  CANCELADO: []
};

export function canTransitionOrder(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}
