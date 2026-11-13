export type UnitType = 'PRENDA' | 'KILOGRAMO' | 'FIJO';

export function calculateLineTotal(unitType: UnitType, basePrice: number, quantity: number, weightKg?: number) {
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw Object.assign(new Error('El precio no puede ser negativo.'), { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw Object.assign(new Error('La cantidad debe ser mayor que cero.'), { status: 400 });
  }
  if (unitType === 'KILOGRAMO' && (!Number.isFinite(weightKg) || !weightKg || weightKg <= 0)) {
    throw Object.assign(new Error('Ingresa un peso positivo para el servicio por kilogramo.'), { status: 400 });
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
