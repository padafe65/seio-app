-- Secure PDF resources and student submission history for improvement plans.
ALTER TABLE improvement_plans
  ADD COLUMN plan_pdf_path VARCHAR(500) NULL,
  ADD COLUMN plan_pdf_original_name VARCHAR(255) NULL,
  ADD COLUMN published_at DATETIME NULL,
  ADD COLUMN physical_delivery_required TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS improvement_plan_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  improvement_plan_id INT NOT NULL,
  student_id INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  file_size INT UNSIGNED NOT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  review_status VARCHAR(30) NOT NULL DEFAULT 'submitted',
  review_feedback TEXT NULL,
  reviewed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_plan_submission_latest (improvement_plan_id, submitted_at),
  KEY idx_student_plan_submissions (student_id, improvement_plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS improvement_email_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  teacher_id INT NOT NULL,
  phase TINYINT UNSIGNED NOT NULL,
  academic_year SMALLINT UNSIGNED NOT NULL,
  notification_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  recipients JSON NULL,
  last_error TEXT NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_improvement_email_event (student_id, teacher_id, phase, academic_year, notification_type),
  KEY idx_improvement_email_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
