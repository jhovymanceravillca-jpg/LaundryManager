import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error';

const isMysqlError = (error: unknown, code: string): error is Error & { code: string } =>
  error instanceof Error && 'code' in error && error.code === code;

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Revisa los datos ingresados.', details: error.flatten().fieldErrors });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (isMysqlError(error, 'ER_DUP_ENTRY')) {
    res.status(409).json({ error: 'El valor ya está registrado. Revisa los datos e inténtalo de nuevo.' });
    return;
  }
  if (isMysqlError(error, 'ER_NO_SUCH_TABLE') && error.message.includes('app_settings')) {
    res.status(503).json({ error: 'Falta aplicar la migración de apariencia de la base de datos. Consulta database/migrations/001-app-settings.sql.' });
    return;
  }
  if (isMysqlError(error, 'ER_BAD_FIELD_ERROR') && error.message.includes('background_mode')) {
    res.status(503).json({ error: 'Falta aplicar la migración del fondo de apariencia. Consulta database/migrations/002-appearance-background.sql.' });
    return;
  }
  if (isMysqlError(error, 'ER_BAD_FIELD_ERROR') && error.message.includes('token_version')) {
    res.status(503).json({ error: 'Falta aplicar la migración de sesiones de usuario. Consulta database/migrations/003-user-session-version.sql.' });
    return;
  }
  if (error instanceof Error && 'status' in error &&
      typeof error.status === 'number' && [400, 401, 404, 409].includes(error.status)) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error');
  res.status(500).json({ error: 'Ocurrió un error interno. Intenta nuevamente.' });
};
