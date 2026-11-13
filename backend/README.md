# Backend

API Express con TypeScript, validación Zod, sesiones JWT en cookie HttpOnly y pool `mysql2/promise`.

1. `cp .env.example .env` y ajusta credenciales/secreto.
2. `npm install`
3. `npm run dev` para desarrollo; `npm run build && npm start` para producción.
4. En la primera visita a la interfaz, crea la cuenta administradora inicial con una contraseña de al menos 12 caracteres. La ruta de configuración inicial sólo permite crear la cuenta si aún no hay usuarios.

El usuario MySQL de aplicación debe limitarse a la IP de VM2 y a la base `laundry_manager`. No uses credenciales root.
