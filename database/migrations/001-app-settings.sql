USE laundry_manager;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  accent_color CHAR(7) NOT NULL DEFAULT '#2863e9',
  font_family VARCHAR(24) NOT NULL DEFAULT 'system',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO app_settings (setting_key, accent_color, font_family)
VALUES ('appearance', '#2863e9', 'system');
