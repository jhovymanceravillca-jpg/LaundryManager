-- Aplica todas las migraciones en orden (para bases nuevas o existentes).
-- Ejecutar con el usuario root/administrador de MySQL.
-- Uso: mysql -u root -p < database/migrations/all-migrations.sql

SOURCE 001-app-settings.sql;
SOURCE 002-appearance-background.sql;
SOURCE 003-user-session-version.sql;
SOURCE 005-user-profile-fields.sql;
SOURCE 006-client-portal.sql;
SOURCE 007-user-avatar.sql;
SOURCE 008-avatar-mediumtext.sql;
SOURCE 009-shop-details.sql;
SOURCE 010-client-extras.sql;
