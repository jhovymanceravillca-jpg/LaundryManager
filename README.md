# LaundryManager

Sistema de gestión de lavandería en español, preparado para ejecutarse localmente o desplegarse en tres máquinas Ubuntu: React/Nginx, API Node.js/Express y MySQL.

El administrador puede elegir una paleta de 12 colores, una tipografía y un fondo blanco o casi negro desde Configuración. La apariencia se guarda en MySQL y se comparte en toda la aplicación.

## Requisitos

- Node.js LTS y npm
- MySQL 8+
- Navegador moderno

## Inicio local en Windows (PowerShell)

Instala Node.js LTS y MySQL 8. Desde PowerShell, en la carpeta del proyecto, ejecuta el asistente de configuración. Te pedirá la contraseña actual de root en el prompt oculto de MySQL. Genera un usuario `laundry_api` local con permisos limitados, aplica el esquema y el catálogo de desarrollo, y guarda los secretos protegidos en `%LOCALAPPDATA%\LaundryManager\backend.env` (fuera de la carpeta del proyecto):

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\database\scripts\setup-windows.ps1
```

Luego inicia la API:

```powershell
Set-Location backend
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

En otra terminal, inicia el frontend:

```powershell
Set-Location frontend
npm.cmd install
npm.cmd run dev
```

Abre la URL que muestra Vite. En la primera visita, crea tu cuenta administradora con una contraseña larga (al menos 12 caracteres); se guarda como hash en MySQL. El proxy de desarrollo reenvía `/api` a `http://localhost:3000`.

Si la base ya existía antes de la personalización visual, ejecuta primero la migración `001-app-settings.sql`. Para añadir la opción de fondo a una instalación que ya tenía esa tabla, abre CMD en la carpeta principal del proyecto y ejecuta:

```cmd
"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" --protocol=TCP --host=127.0.0.1 --user=root --password < "database\migrations\002-appearance-background.sql"
```

MySQL pedirá la contraseña de `root` sin mostrarla. Las instalaciones nuevas que apliquen `database/schema.sql` ya incluyen esta columna y no necesitan la migración 002.

En Linux/macOS, aplica la misma migración con `mysql -u root -p < database/migrations/001-app-settings.sql`.

## Inicio local en Linux/macOS

1. Crear la base y aplicar el esquema:

   ```sh
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/seeds/development.sql
   ```

   El segundo comando añade catálogo y precios de ejemplo sólo para desarrollo. En producción, crea el catálogo con tus precios reales.

2. Configurar y ejecutar la API:

   ```sh
   cd backend
   cp .env.example .env
   npm install
   npm run build
   npm run create-admin
   npm run dev
   ```

   El asistente `create-admin` solicita las credenciales de administrador de forma interactiva y guarda únicamente el hash de la contraseña.

3. En otra terminal, ejecutar React:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

   Abrir la URL que muestra Vite. El proxy de desarrollo reenvía `/api` a `http://localhost:3000`.

## Flujo funcional

Iniciar sesión → registrar cliente → crear pedido con prendas y servicios → registrar pago → avanzar estado → confirmar entrega → consultar dashboard y reportes.

El backend calcula importes usando los precios almacenados en MySQL. Los formularios no envían totales confiables. No se incluyen usuarios ni datos de clientes predefinidos.

## Arquitectura

```text
Navegador → React/Nginx (VM1) → /api → Express (VM2) → MySQL (VM3)
```

Consulta [docs/architecture.md](docs/architecture.md), [docs/deployment.md](docs/deployment.md), [docs/network.md](docs/network.md), [docs/testing.md](docs/testing.md) y [docs/presentation.md](docs/presentation.md) para el modelo, puesta en marcha, red, pruebas y defensa académica. El despliegue de ejemplo usa una red interna de VirtualBox `10.77.0.0/24` y reglas NAT para acceder desde Windows.

## Seguridad y alcance

- Nunca publiques `.env`, contraseñas ni claves JWT.
- No expongas MySQL a Internet; limita 3306 a VM2.
- El diagnóstico de MySQL requiere sesión autenticada.
- La configuración lista para producción requiere HTTPS, secretos propios y reglas SSH/UFW ajustadas a la red administrativa.
- Las pruebas entre VMs requieren máquinas Ubuntu reales; no se ejecutaron en este entorno.
