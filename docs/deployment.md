# Despliegue en tres máquinas

1. Crea `web-01`, `api-01` y `db-01` con Ubuntu Server LTS. En VirtualBox usa Adaptador 1 NAT y Adaptador 2 en red solo-anfitrión (Host-only) `192.168.56.0/24`; asigna respectivamente `192.168.56.10`, `.20` y `.30` en Netplan. La guía de red documenta el acceso desde Windows.
2. En VM3, configura `bind-address = 192.168.56.30` en `/etc/mysql/mysql.conf.d/mysqld.cnf` usando `deployment/vm3/mysqld.cnf.example`, reinicia MySQL y aplica `database/schema.sql`. En una base existente, aplica además las migraciones pendientes, incluida `database/migrations/003-user-session-version.sql`, antes de actualizar la API. Crea el usuario de aplicación limitado a `192.168.56.20` según [database.md](database.md).
3. En VM2, copia el backend, crea `.env` con `DB_HOST=192.168.56.30` y el usuario de VM3, genera un JWT aleatorio de al menos 32 caracteres y marca `COOKIE_SECURE=true` al utilizar HTTPS. Ejecuta `npm ci`, `npm run build`, `npm run create-admin` y `pm2 start ecosystem.config.cjs --env production`. El endpoint `/api/auth/setup` sólo permite crear la primera cuenta mientras la tabla `users` esté vacía; en producción crea el administrador con `npm run create-admin` antes de exponer VM1 y confirma que `GET /api/auth/setup-status` responde `setupRequired:false`. Si `NODE_ENV=production` y `COOKIE_SECURE` no es `true`, la API muestra una advertencia al iniciar.

   Antes de iniciar la API, aplica también `database/migrations/006-client-portal.sql` con el usuario root de MySQL para habilitar el portal del cliente (rol `CLIENT` y tabla `laundry_shops` con lavanderías de ejemplo).
4. En VM1, ajusta `proxy_pass` de Nginx si cambió la IP de VM2. Ejecuta `npm ci`, `npm run build`, publica `dist` en `/var/www/laundry-manager/dist`, instala `nginx.conf`, verifica con `sudo nginx -t` y recarga.
5. Configura SSH y firewall desde las redes administrativas/usuarias conocidas antes de habilitar UFW. Usa los scripts de VM1, VM2 y VM3 sólo después de definir sus variables `ADMIN_CIDR`, `USER_CIDR`, `WEB_IP` y `API_IP` requeridas. Con Host-only, usa `192.168.56.0/24` como red administrativa desde Windows; si además usas reenvío NAT, valida el origen antes de emplear `10.0.2.2/32` en esas variables.
6. Desde VM1: `curl -i http://192.168.56.20:3000/api/health`. Desde VM2: `curl -i http://localhost:3000/api/health`; verifica MySQL desde VM2 con `mysql -h 192.168.56.30 -u laundry_api -p laundry_manager`. Desde Windows, valida el sitio en `http://192.168.56.10` (o `http://127.0.0.1:8080` si conservas el reenvío NAT).

## HTTPS para producción

No habilites HTTPS ni marques `COOKIE_SECURE=true` hasta que exista un dominio real con DNS apuntando a VM1 y el puerto 80 accesible para emitir el certificado. En Nginx, configura `server_name` con ese dominio y valida la configuración. Instala Certbot con su complemento de Nginx y sigue el asistente para emitir el certificado:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx
sudo certbot renew --dry-run
```

Certbot debe configurar el certificado y la redirección HTTP→HTTPS. Comprueba desde un cliente que `http://` redirija y que `https://` presente un certificado válido. Sólo entonces configura `COOKIE_SECURE=true` en VM2 y reinicia la API con PM2. Abre el puerto 443 en la red perimetral y ejecuta `ENABLE_HTTPS=true` al configurar el firewall de VM1. Mantén el puerto 3000 accesible únicamente desde VM1 y el 3306 únicamente desde VM2.

## Criterios antes de producción

- CI en verde, incluidas las pruebas de integración MySQL, y builds de backend y frontend.
- Prueba manual completa de creación, cobro, transición de estados, entrega, historial y reportes.
- Prueba real de los tres nodos y confirmación de que los firewalls bloquean las rutas no autorizadas.
- HTTPS verificado con el dominio definitivo, cookies seguras y renovación automática del certificado.
- Respaldo diario en destino externo y restauración mensual verificada en una base aislada.

Las VMs, el dominio y los certificados dependen del entorno del operador; no se consideran validados hasta ejecutar y registrar estas comprobaciones.

Los scripts de instalación asumen Node/NPM disponibles en el repositorio de Ubuntu; para producción, instala una versión LTS vigente desde un origen confiable y verifica sus firmas. Ajusta los directorios si el proyecto se despliega en otra ruta. Registra los resultados de conectividad, API, MySQL y flujo de navegador al completar el despliegue de los tres nodos.
