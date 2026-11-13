# Database

Aplica `schema.sql` en MySQL 8. El script crea la base `laundry_manager`, tablas, índices y claves foráneas; no inserta clientes ni usuarios. `seeds/development.sql` contiene únicamente el catálogo y los precios de ejemplo para pruebas locales; no lo ejecutes en producción.

Restringe el puerto 3306 a VM2. Para la creación segura del usuario de aplicación y copias de seguridad, consulta [docs/database.md](../docs/database.md).
