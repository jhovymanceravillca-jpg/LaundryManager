export function toMySqlUtcDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError('Fecha y hora no válidas.');
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
