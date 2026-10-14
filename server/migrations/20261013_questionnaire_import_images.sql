-- Almacenamiento privado y asociación de imágenes de preguntas importadas.
CREATE TABLE IF NOT EXISTS questionnaire_import_assets (
  id CHAR(36) NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  batch_id BIGINT UNSIGNED NULL,
  questionnaire_id BIGINT UNSIGNED NULL,
  stored_filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_questionnaire_assets_owner (owner_user_id),
  KEY idx_questionnaire_assets_batch (batch_id),
  KEY idx_questionnaire_assets_questionnaire (questionnaire_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questionnaire_import_item_assets (
  item_id BIGINT UNSIGNED NOT NULL,
  asset_id CHAR(36) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (item_id, asset_id),
  KEY idx_questionnaire_item_assets_asset (asset_id),
  CONSTRAINT fk_questionnaire_item_assets_item
    FOREIGN KEY (item_id) REFERENCES questionnaire_import_items (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_questionnaire_item_assets_asset
    FOREIGN KEY (asset_id) REFERENCES questionnaire_import_assets (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
