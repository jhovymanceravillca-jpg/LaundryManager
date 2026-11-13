import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Revisa los datos ingresados.', details: error.flatten().fieldErrors });
    return;
  }
  if (error instanceof Error && 'code' in error && error.code === 'ER_NO_SUCH_TABLE' &&
      error.message.includes('app_settings')) {
    res.status(503).json({ error: 'Falta aplicar la migración de apariencia de la base de datos. Consulta database/migrations/001-app-settings.sql.' });
    return;
  }
  if (error instanceof Error && 'code' in error && error.code === 'ER_BAD_FIELD_ERROR' &&
      error.message.includes('background_mode')) {
    res.status(503).json({ error: 'Falta aplicar la migración del fondo de apariencia. Consulta database/migrations/002-appearance-background.sql.' });
    return;
  }
  if (error instanceof Error && 'status' in error &&
      typeof error.status === 'number' && [400, 404, 409].includes(error.status)) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error');
  res.status(500).json({ error: 'Ocurrió un error interno. Intenta nuevamente.' });
};
