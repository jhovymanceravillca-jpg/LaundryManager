USE laundry_manager;

SET @avatar_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'
);
SET @avatar_sql = IF(@avatar_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER phone',
  'SELECT ''La columna avatar_url ya existe'' AS migration');
PREPARE avatar_stmt FROM @avatar_sql;
EXECUTE avatar_stmt;
DEALLOCATE PREPARE avatar_stmt;
