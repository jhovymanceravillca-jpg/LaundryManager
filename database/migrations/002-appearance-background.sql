USE laundry_manager;

SET @background_mode_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_settings' AND COLUMN_NAME = 'background_mode'
);
SET @background_mode_sql = IF(@background_mode_exists = 0,
  'ALTER TABLE app_settings ADD COLUMN background_mode VARCHAR(8) NOT NULL DEFAULT ''light''',
  'SELECT ''La columna background_mode ya existe'' AS migration');
PREPARE background_mode_stmt FROM @background_mode_sql;
EXECUTE background_mode_stmt;
DEALLOCATE PREPARE background_mode_stmt;
