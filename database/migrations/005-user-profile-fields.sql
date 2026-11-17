USE laundry_manager;

SET @phone_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone'
);
SET @phone_sql = IF(@phone_exists = 0,
  'ALTER TABLE users ADD COLUMN phone VARCHAR(40) NULL AFTER email',
  'SELECT ''La columna phone ya existe'' AS migration');
PREPARE phone_stmt FROM @phone_sql;
EXECUTE phone_stmt;
DEALLOCATE PREPARE phone_stmt;

SET @last_login_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login_at'
);
SET @last_login_sql = IF(@last_login_exists = 0,
  'ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL AFTER token_version',
  'SELECT ''La columna last_login_at ya existe'' AS migration');
PREPARE last_login_stmt FROM @last_login_sql;
EXECUTE last_login_stmt;
DEALLOCATE PREPARE last_login_stmt;
