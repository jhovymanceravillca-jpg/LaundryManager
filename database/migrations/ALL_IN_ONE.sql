-- ============================================================
-- MIGRACIONES COMPLETAS - LaundryManager
-- Pega TODO este archivo en el editor SQL de Railway y ejecuta.
-- ============================================================

-- 001: app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  accent_color CHAR(7) NOT NULL DEFAULT '#2863e9',
  font_family VARCHAR(24) NOT NULL DEFAULT 'system',
  background_mode VARCHAR(8) NOT NULL DEFAULT 'light',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO app_settings (setting_key, accent_color, font_family, background_mode)
VALUES ('appearance', '#2863e9', 'system', 'light');

-- 002: appearance background (idempotent)
SET @bg_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_settings' AND COLUMN_NAME = 'background_mode');
SET @bg_sql = IF(@bg_exists = 0, 'ALTER TABLE app_settings ADD COLUMN background_mode VARCHAR(8) NOT NULL DEFAULT ''light''', 'SELECT ''ok''');
PREPARE bg_stmt FROM @bg_sql; EXECUTE bg_stmt; DEALLOCATE PREPARE bg_stmt;

-- 003: token_version (idempotent)
SET @tv_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'token_version');
SET @tv_sql = IF(@tv_exists = 0, 'ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0', 'SELECT ''ok''');
PREPARE tv_stmt FROM @tv_sql; EXECUTE tv_stmt; DEALLOCATE PREPARE tv_stmt;

-- 005: user profile fields (idempotent)
SET @phone_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone');
SET @phone_sql = IF(@phone_exists = 0, 'ALTER TABLE users ADD COLUMN phone VARCHAR(40) NULL AFTER email', 'SELECT ''ok''');
PREPARE phone_stmt FROM @phone_sql; EXECUTE phone_stmt; DEALLOCATE PREPARE phone_stmt;

SET @lastlogin_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login_at');
SET @lastlogin_sql = IF(@lastlogin_exists = 0, 'ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL AFTER token_version', 'SELECT ''ok''');
PREPARE lastlogin_stmt FROM @lastlogin_sql; EXECUTE lastlogin_stmt; DEALLOCATE PREPARE lastlogin_stmt;

-- 006: client portal
ALTER TABLE users MODIFY role ENUM('ADMIN','STAFF','CLIENT') NOT NULL DEFAULT 'STAFF';

CREATE TABLE IF NOT EXISTS laundry_shops (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  opening_hours VARCHAR(80) NULL,
  rating DECIMAL(2,1) NOT NULL DEFAULT 4.5,
  services_summary VARCHAR(255) NULL,
  image_url VARCHAR(500) NULL,
  detergents VARCHAR(255) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_shops_active (active)
) ENGINE=InnoDB;

INSERT INTO laundry_shops (name, address, phone, latitude, longitude, opening_hours, rating, services_summary, image_url, detergents)
SELECT * FROM (SELECT
  'Lavandería Central' AS name, 'Av. 16 de Julio 1234, La Paz' AS address, '+591 70000001' AS phone,
  -16.4950000 AS latitude, -68.1330000 AS longitude, 'Lun-Sáb 8:00-20:00' AS opening_hours, 4.8 AS rating,
  'Lavado, planchado y tintorería' AS services_summary, 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=600&q=80' AS image_url, 'Ariel,Ace,Suavitel,Ecológico' AS detergents
UNION ALL SELECT 'Express Wash', 'Calle Comercio 567, La Paz', '+591 70000002', -16.4980000, -68.1380000, 'Lun-Dom 7:00-22:00', 4.6, 'Lavado express y delivery', 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=600&q=80', 'Ariel,Omo,Downy'
UNION ALL SELECT 'Limpio & Seco', 'Av. Arce 890, La Paz', '+591 70000003', -16.5020000, -68.1280000, 'Lun-Vie 9:00-19:00', 4.7, 'Lavado por kilo y prendas delicadas', 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=600&q=80', 'Persil,Woolite,Suavitel'
UNION ALL SELECT 'Eco Lavandería', 'Zona Sur, Calle 21 456, La Paz', '+591 70000004', -16.5400000, -68.0900000, 'Lun-Sáb 8:30-18:30', 4.9, 'Productos ecológicos y cuidado premium', 'https://images.unsplash.com/photo-1489274495757-95c7c837b101?w=600&q=80', 'Ecológico,Hipoalergénico,Biolavable'
UNION ALL SELECT 'Aqua Clean', 'El Alto, Av. 6 de Marzo 321', '+591 70000005', -16.5100000, -68.1800000, 'Lun-Dom 6:00-21:00', 4.5, 'Servicio 24h y secado rápido', 'https://images.unsplash.com/photo-1521656693074-61cd59399954?w=600&q=80', 'Ariel,Ace,Secado rápido'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM laundry_shops LIMIT 1);

-- 007: avatar (idempotent)
SET @av_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url');
SET @av_sql = IF(@av_exists = 0, 'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER phone', 'SELECT ''ok''');
PREPARE av_stmt FROM @av_sql; EXECUTE av_stmt; DEALLOCATE PREPARE av_stmt;

-- 008: avatar to MEDIUMTEXT
ALTER TABLE users MODIFY avatar_url MEDIUMTEXT NULL;

-- 009: shop_reviews table
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

-- 010: client extras
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id BIGINT UNSIGNED NOT NULL,
  shop_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, shop_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_fav_shop FOREIGN KEY (shop_id) REFERENCES laundry_shops(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shop_bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shop_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  service VARCHAR(80) NOT NULL,
  scheduled_at DATETIME NOT NULL,
  status ENUM('PENDIENTE','CONFIRMADO','CANCELADO','COMPLETADO') NOT NULL DEFAULT 'PENDIENTE',
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_shop FOREIGN KEY (shop_id) REFERENCES laundry_shops(id),
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_booking_user (user_id, scheduled_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shop_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shop_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  sender ENUM('CLIENTE','NEGOCIO') NOT NULL DEFAULT 'CLIENTE',
  message VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_shop FOREIGN KEY (shop_id) REFERENCES laundry_shops(id),
  CONSTRAINT fk_msg_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_msg_shop (shop_id, created_at)
) ENGINE=InnoDB;

-- Seed reviews (only if empty)
INSERT INTO shop_reviews (shop_id, user_id, rating, comment, created_at)
SELECT 1, 1, 5, 'Excelente servicio, ropa impecable y puntual.', '2026-11-10'
WHERE NOT EXISTS (SELECT 1 FROM shop_reviews LIMIT 1);