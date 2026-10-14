-- Staging tables for bulk-imported questionnaires.
-- Imported questions stay here until an authorized reviewer verifies the key and rights.

CREATE TABLE IF NOT EXISTS questionnaire_import_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  category VARCHAR(120) NOT NULL DEFAULT 'Pre-ICFES',
  grade VARCHAR(20) NOT NULL DEFAULT '11',
  phase VARCHAR(20) NOT NULL DEFAULT '1',
  teacher_id BIGINT UNSIGNED NOT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  source_filename VARCHAR(255) NULL,
  source_format VARCHAR(30) NULL,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  published_questionnaire_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_question_import_batches_owner (created_by_user_id),
  KEY idx_question_import_batches_teacher (teacher_id),
  KEY idx_question_import_batches_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questionnaire_import_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  source_question_number VARCHAR(40) NULL,
  source_location VARCHAR(255) NULL,
  question_text LONGTEXT NOT NULL,
  option1 LONGTEXT NULL,
  option2 LONGTEXT NULL,
  option3 LONGTEXT NULL,
  option4 LONGTEXT NULL,
  correct_answer CHAR(1) NULL,
  image_url TEXT NULL,
  image_references LONGTEXT NULL,
  answer_status ENUM('pending', 'verified') NOT NULL DEFAULT 'pending',
  rights_status ENUM('pending', 'original', 'licensed', 'replaced', 'exclude') NOT NULL DEFAULT 'pending',
  rights_notes TEXT NULL,
  review_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  published_question_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_question_import_position (batch_id, position),
  KEY idx_question_import_batch_review (batch_id, review_status),
  CONSTRAINT fk_question_import_items_batch
    FOREIGN KEY (batch_id) REFERENCES questionnaire_import_batches (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Imported Saber 11 questionnaires are private products. Only their owner,
-- super administrators, and explicitly authorized accounts can access them.
CREATE TABLE IF NOT EXISTS restricted_questionnaires (
  questionnaire_id BIGINT UNSIGNED NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (questionnaire_id),
  KEY idx_restricted_questionnaire_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questionnaire_access_grants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  questionnaire_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  granted_by_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_questionnaire_access_user (questionnaire_id, user_id),
  KEY idx_questionnaire_access_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
