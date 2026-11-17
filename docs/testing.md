# Pruebas y verificación

## Automatizadas (backend)

Desde `backend`:

```powershell
npm.cmd test
npm.cmd run test:integration
npm.cmd run build
npm.cmd audit
```

Las pruebas unitarias verifican cálculo por prenda/kilogramo/servicio fijo, redondeo monetario, validaciones y transiciones de estado. La prueba de integración requiere una base MySQL exclusiva cuyo nombre comience con `laundry_manager_test`; elimina y reconstruye esa base al ejecutarse. Configura sus variables `DB_*`, `NODE_ENV=test` y `JWT_SECRET` antes de correrla. Nunca apuntes esta prueba a una base con datos reales. El workflow de CI levanta MySQL 8.4 y ejecuta pruebas, integraciones y builds de backend y frontend.

En Windows, desde la raíz del repositorio, ejecuta `.\database\scripts\test-integration-windows.ps1`. El script pide la contraseña root con entrada oculta, configura la prueba para usar únicamente `laundry_manager_test` y limpia las variables temporales al finalizar.

## Flujo funcional local

Con MySQL, API y frontend iniciados, inicia sesión y verifica manualmente:

1. Registrar un cliente y modificar sus datos; abrir su historial.
2. Crear un pedido con varios artículos, un pago inicial y método elegido.
3. Abrir el pedido, comprobar precios históricos, pagos e historial; editar vencimiento/notas e imprimir comprobante.
4. Registrar pagos adicionales con distintos métodos; el servidor debe rechazar montos superiores al saldo.
5. Avanzar de recibido a proceso y terminado; buscar por código en Entregas y confirmar receptor.
6. Confirmar que el pedido figura en la lista de entregas y en reportes.
7. Como administrador, anular un pago; confirmar que permanece visible con estado anulado y no se suma al total cobrado.
8. Cambiar la contraseña propia desde Configuración y verificar que las otras sesiones del mismo usuario dejan de ser válidas.
9. Cerrar sesión y confirmar que el token anterior ya no permite acceder a `/api/auth/me`.
10. Recargar la aplicación para comprobar persistencia.

Pruebas rápidas de salud:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-WebRequest http://localhost:5173
```

## Prueba de tres VMs

Pendiente hasta instalar y configurar las tres VMs Ubuntu en VirtualBox. Registra las IP, los comandos ejecutados, las respuestas HTTP y la comprobación SQL; no declares aprobada una prueba de red que no se haya ejecutado.

Desde VM1: `curl -i http://192.168.56.20:3000/api/health`.
Desde VM2: `curl -i http://localhost:3000/api/health` y `mysql -h 192.168.56.30 -u laundry_api -p laundry_manager`.
Desde VM3: comprobar base/tablas con `mysql` y confirmar que el firewall sólo permite MySQL desde VM2.
Desde Windows, abre `http://192.168.56.10` (Host-only). Para diagnosticar VM2, usa `curl` desde VM1 o una sesión SSH autorizada; no expongas el puerto 3000 fuera de la red privada.

## Verificación de HTTPS y producción

Después de configurar el dominio y Certbot, confirma desde un cliente:

```bash
curl -I http://TU_DOMINIO_REAL
curl -I https://TU_DOMINIO_REAL
sudo certbot renew --dry-run
```

Sustituye `TU_DOMINIO_REAL` por el dominio configurado. Comprueba que HTTP redirige a HTTPS, que HTTPS responde con certificado válido y que la renovación de prueba finaliza correctamente. Confirma también `COOKIE_SECURE=true` en VM2 y que los puertos de API y MySQL no estén expuestos a clientes externos. No marques estas comprobaciones como realizadas hasta ejecutarlas en el entorno de despliegue.
