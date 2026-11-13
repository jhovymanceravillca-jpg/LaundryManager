# Pruebas y verificación

## Automatizadas (backend)

Desde `backend`:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd audit
```

Las pruebas unitarias verifican cálculo por prenda/kilogramo/servicio fijo, redondeo monetario, validaciones y transiciones de estado. Estas pruebas no sustituyen una prueba de integración con MySQL.

## Flujo funcional local

Con MySQL, API y frontend iniciados, inicia sesión y verifica manualmente:

1. Registrar un cliente y modificar sus datos; abrir su historial.
2. Crear un pedido con varios artículos, un pago inicial y método elegido.
3. Abrir el pedido, comprobar precios históricos, pagos e historial; editar vencimiento/notas e imprimir comprobante.
4. Registrar pagos adicionales con distintos métodos; el servidor debe rechazar montos superiores al saldo.
5. Avanzar de recibido a proceso y terminado; buscar por código en Entregas y confirmar receptor.
6. Confirmar que el pedido figura en la lista de entregas y en reportes.
7. Como administrador, anular un pago; confirmar que permanece visible con estado anulado y no se suma al total cobrado.
8. Recargar la aplicación para comprobar persistencia.

Pruebas rápidas de salud:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-WebRequest http://localhost:5173
```

## Prueba de tres VMs

Pendiente hasta instalar y configurar las tres VMs Ubuntu en VirtualBox. Registra las IP y comandos ejecutados, las respuestas HTTP y la comprobación SQL; no declares aprobada una prueba de red que no se haya ejecutado.

Desde VM1: `curl -i http://10.77.0.20:3000/api/health`.
Desde VM2: `curl -i http://localhost:3000/api/health` y `mysql -h 10.77.0.30 -u laundry_api -p laundry_manager`.
Desde VM3: comprobar base/tablas con `mysql` y confirmar que el firewall sólo permite MySQL desde VM2.
Desde Windows, abre `http://127.0.0.1:8080` (NAT con reenvío a VM1) y `http://127.0.0.1:3001/api/health` para el diagnóstico temporal de VM2.
