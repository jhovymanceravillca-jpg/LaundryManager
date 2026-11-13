# Base de datos

La definición ejecutable está en `database/schema.sql`. `database/seeds/development.sql` contiene precios y tipos de ejemplo sólo para pruebas; no lo ejecutes en producción. Los clientes se desactivan en vez de borrarse; los pedidos se conservan por sus relaciones y los cambios de estado mantienen historial. Los precios de cada detalle quedan guardados como copia histórica. Los pagos anulados conservan su importe, fecha y usuario de anulación.

Las fechas de entrega se almacenan como UTC en la columna `DATETIME`; la API las convierte a ISO 8601 con sufijo `Z` al leer y escribir.

En VM3, crea un usuario limitado a VM2 en la consola MySQL (sustituye el secreto):

```sql
CREATE USER 'laundry_api'@'10.77.0.20' IDENTIFIED BY 'REEMPLAZAR_POR_UN_SECRETO';
GRANT SELECT, INSERT, UPDATE ON laundry_manager.* TO 'laundry_api'@'10.77.0.20';
FLUSH PRIVILEGES;
```

El usuario no recibe privilegios globales ni se usa root desde la aplicación. Mantén copias fuera de la VM de base de datos:

```bash
mysqldump --single-transaction laundry_manager > laundry_manager_$(date +%F).sql
mysql laundry_manager < respaldo.sql
```

El script `database/scripts/backup-db.sh` solicita la contraseña de MySQL sin escribirla en la línea de comandos. Almacena el respaldo en un destino seguro independiente y prueba periódicamente la restauración.
