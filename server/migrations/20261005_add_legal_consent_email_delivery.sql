-- Ejecutar una vez en cada base de datos que ya tenga legal_consents.
ALTER TABLE legal_consents
  ADD COLUMN notification_status ENUM('pending','sent','partial','failed') NOT NULL DEFAULT 'pending' AFTER notes;

ALTER TABLE legal_consents
  ADD COLUMN notification_recipients JSON NULL AFTER notification_status;

ALTER TABLE legal_consents
  ADD COLUMN notification_details JSON NULL AFTER notification_recipients;
