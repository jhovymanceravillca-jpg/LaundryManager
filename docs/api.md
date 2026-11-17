# API REST

Todas las respuestas son JSON, excepto `204 No Content`. Las rutas de negocio requieren sesión autenticada mediante cookie HttpOnly.

| Grupo | Rutas |
|---|---|
| Sesión | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/profile`, `PATCH /api/auth/profile`, `PATCH /api/auth/password` (contraseña propia) |
| Cliente | `POST /api/auth/register-client`, `GET /api/client/summary`, `GET /api/client/orders`, `GET /api/client/shops?lat=&lng=` |
| Usuarios | `GET/POST /api/users`, `PATCH /api/users/:id`, `PATCH /api/users/:id/password` (administrador) |
| Clientes | `GET/POST /api/customers`, `GET/PUT/DELETE /api/customers/:id`, `GET /api/customers/:id/history` |
| Prendas y servicios | `GET/POST/PUT /api/garments`, `GET/POST/PUT /api/services` (escritura administrativa) |
| Pedidos | `GET /api/orders?status=TERMINADO&search=texto`, `POST /api/orders` (opcionalmente con pago inicial/método), `GET/PUT /api/orders/:id`, `PATCH /api/orders/:id/status` |
| Pagos y entregas | `GET /api/payments`, `GET /api/orders/:id/payments`, `POST /api/orders/:id/payments`, `PATCH /api/payments/:id/void` (administrador), `GET /api/deliveries`, `POST /api/orders/:id/deliver` |
| Resumen y reportes | `GET /api/dashboard/summary`, `GET /api/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD`, `GET /api/reports/orders` |
| Salud | `GET /api/health`, `GET /api/health/database` (requiere sesión) |

Las rutas `GET /api/customers`, `GET /api/orders`, `GET /api/payments` y `GET /api/deliveries` aceptan `page` (desde 1) y `pageSize` (entre 1 y 200; por defecto 50). Devuelven `{ items, page, pageSize, total }`. Clientes y pedidos conservan sus filtros `search` y `status`; la interfaz muestra 50 resultados por página.

En administración, `PATCH /api/users/:id` acepta `role` y/o `active`; `PATCH /api/users/:id/password` acepta una nueva contraseña de al menos 12 caracteres. Los cambios de rol, estado y contraseña revocan las sesiones previas. No se permite desactivar ni degradar al administrador que realiza la solicitud; debe quedar al menos un administrador activo.

`POST /api/auth/logout` requiere una sesión válida, incrementa `token_version` del usuario y borra la cookie. Un token copiado deja de ser aceptado aunque no haya expirado. Como `token_version` es por usuario, el cierre de sesión invalida también las demás sesiones abiertas de esa misma cuenta.

El backend usa Zod para validar entradas y consultas parametrizadas. El precio y total del pedido se obtienen de MySQL, nunca del navegador. Los errores de validación devuelven 400; autenticación, 401; permisos, 403; conflictos de negocio, 409; no encontrado, 404.
