# API REST

Todas las respuestas son JSON, excepto `204 No Content`. Las rutas de negocio requieren sesión autenticada mediante cookie HttpOnly.

| Grupo | Rutas |
|---|---|
| Sesión | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Usuarios | `GET/POST /api/users` (administrador) |
| Clientes | `GET/POST /api/customers`, `GET/PUT/DELETE /api/customers/:id`, `GET /api/customers/:id/history` |
| Prendas y servicios | `GET/POST/PUT /api/garments`, `GET/POST/PUT /api/services` (escritura administrativa) |
| Pedidos | `GET /api/orders?status=TERMINADO&search=texto`, `POST /api/orders` (opcionalmente con pago inicial/método), `GET/PUT /api/orders/:id`, `PATCH /api/orders/:id/status` |
| Pagos y entregas | `GET /api/payments`, `GET /api/orders/:id/payments`, `POST /api/orders/:id/payments`, `PATCH /api/payments/:id/void` (administrador), `GET /api/deliveries`, `POST /api/orders/:id/deliver` |
| Resumen y reportes | `GET /api/dashboard/summary`, `GET /api/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD`, `GET /api/reports/orders` |
| Salud | `GET /api/health`, `GET /api/health/database` (requiere sesión) |

El backend usa Zod para validar entradas y consultas parametrizadas. El precio y total del pedido se obtienen de MySQL, nunca del navegador. Los errores de validación devuelven 400; autenticación, 401; permisos, 403; conflictos de negocio, 409; no encontrado, 404.
