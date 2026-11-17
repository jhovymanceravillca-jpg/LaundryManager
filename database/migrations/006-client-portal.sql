USE laundry_manager;

ALTER TABLE users
  MODIFY role ENUM('ADMIN','STAFF','CLIENT') NOT NULL DEFAULT 'STAFF';

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
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_shops_active (active)
) ENGINE=InnoDB;

INSERT INTO laundry_shops (name, address, phone, latitude, longitude, opening_hours, rating, services_summary)
SELECT * FROM (SELECT
  'Lavandería Central' AS name, 'Av. 16 de Julio 1234, La Paz' AS address, '+591 70000001' AS phone,
  -16.4950000 AS latitude, -68.1330000 AS longitude, 'Lun-Sáb 8:00-20:00' AS opening_hours, 4.8 AS rating,
  'Lavado, planchado y tintorería' AS services_summary
UNION ALL SELECT 'Express Wash', 'Calle Comercio 567, La Paz', '+591 70000002', -16.4980000, -68.1380000, 'Lun-Dom 7:00-22:00', 4.6, 'Lavado express y delivery'
UNION ALL SELECT 'Limpio & Seco', 'Av. Arce 890, La Paz', '+591 70000003', -16.5020000, -68.1280000, 'Lun-Vie 9:00-19:00', 4.7, 'Lavado por kilo y prendas delicadas'
UNION ALL SELECT 'Eco Lavandería', 'Zona Sur, Calle 21 456, La Paz', '+591 70000004', -16.5400000, -68.0900000, 'Lun-Sáb 8:30-18:30', 4.9, 'Productos ecológicos y cuidado premium'
UNION ALL SELECT 'Aqua Clean', 'El Alto, Av. 6 de Marzo 321', '+591 70000005', -16.5100000, -68.1800000, 'Lun-Dom 6:00-21:00', 4.5, 'Servicio 24h y secado rápido'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM laundry_shops LIMIT 1);