USE laundry_manager;

ALTER TABLE app_settings
  ADD COLUMN background_mode VARCHAR(8) NOT NULL DEFAULT 'light';
