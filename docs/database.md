# Base de datos

La definición ejecutable está en `database/schema.sql`. `database/seeds/development.sql` contiene precios y tipos de ejemplo sólo para pruebas; no lo ejecutes en producción. Los clientes se desactivan en vez de borrarse; los pedidos se conservan por sus relaciones y los cambios de estado mantienen historial. Los precios de cada detalle quedan guardados como copia histórica. Los pagos anulados conservan su importe, fecha y usuario de anulación.

Si actualizas una base existente, aplica `database/migrations/003-user-session-version.sql` antes de desplegar la nueva API. La migración comprueba la columna en `information_schema` y no falla si ya existe. `token_version` invalida las sesiones vigentes tras un cambio de rol, desactivación, restablecimiento de contraseña o cierre de sesión.

Las fechas de entrega se almacenan como UTC en la columna `DATETIME`; la API las convierte a ISO 8601 con sufijo `Z` al leer y escribir.

En VM3, crea un usuario limitado a VM2 en la consola MySQL (sustituye el secreto):

```sql
CREATE USER 'laundry_api'@'192.168.56.20' IDENTIFIED BY 'REEMPLAZAR_POR_UN_SECRETO';
GRANT SELECT, INSERT, UPDATE ON laundry_manager.* TO 'laundry_api'@'192.168.56.20';
FLUSH PRIVILEGES;
```

El usuario de aplicación no recibe privilegios globales ni se usa root desde la aplicación. Para respaldos usa una cuenta local de MySQL con privilegios adecuados, independiente de `laundry_api`.

El script `database/scripts/backup-db.sh` crea respaldos atómicos con permisos `600` en un directorio `700` y conserva los últimos 30 días por defecto. Antes de usarlo, configura credenciales locales para el mismo usuario del sistema que ejecutará el respaldo:

```bash
mysql_config_editor set --login-path=laundry_backup --host=localhost --user=backup_user --password
```

MySQL solicitará la contraseña de forma interactiva. El usuario de la base debe tener los permisos necesarios para exportar el esquema. La herramienta guarda las credenciales en el archivo de configuración protegido de MySQL, no en los argumentos del proceso. Ejecuta el respaldo manualmente:

```bash
BACKUP_DIR=/var/backups/laundry-manager RETENTION_DAYS=30 bash database/scripts/backup-db.sh
```

Para automatizarlo, instala una tarea diaria en el cron del usuario que configuró el `login-path` (ajusta la ruta al despliegue):

```cron
0 2 * * * BACKUP_DIR=/var/backups/laundry-manager RETENTION_DAYS=30 MYSQL_LOGIN_PATH=laundry_backup bash /opt/LaundryManager/database/scripts/backup-db.sh >> /var/log/laundry-manager-backup.log 2>&1
```

El destino debe estar cifrado y fuera de la VM de base de datos; revisa alertas y registros del cron. Al menos mensualmente, verifica una copia con un usuario local autorizado a crear y eliminar bases de prueba:

```bash
MYSQL_LOGIN_PATH=laundry_restore bash database/scripts/verify-backup.sh /var/backups/laundry-manager/laundry_manager_2026-11-16_020000_1234.sql
```

El verificador restaura en una base temporal aislada, confirma las tablas principales y muestra sus conteos. La elimina al finalizar; si el borrado falla, informa el nombre para eliminarla manualmente tras revisarla. No pruebes la restauración sobre producción.
