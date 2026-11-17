USE laundry_manager;

SET @image_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'laundry_shops' AND COLUMN_NAME = 'image_url'
);
SET @image_sql = IF(@image_exists = 0,
  'ALTER TABLE laundry_shops ADD COLUMN image_url VARCHAR(500) NULL AFTER services_summary',
  'SELECT ''La columna image_url ya existe'' AS migration');
PREPARE image_stmt FROM @image_sql;
EXECUTE image_stmt;
DEALLOCATE PREPARE image_stmt;

SET @detergents_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'laundry_shops' AND COLUMN_NAME = 'detergents'
);
SET @detergents_sql = IF(@detergents_exists = 0,
  'ALTER TABLE laundry_shops ADD COLUMN detergents VARCHAR(255) NULL AFTER image_url',
  'SELECT ''La columna detergents ya existe'' AS migration');
PREPARE detergents_stmt FROM @detergents_sql;
EXECUTE detergents_stmt;
DEALLOCATE PREPARE detergents_stmt;

CREATE TABLE IF NOT EXISTS shop_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shop_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_shop FOREIGN KEY (shop_id) REFERENCES laundry_shops(id),
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_review_shop (shop_id, created_at)
) ENGINE=InnoDB;