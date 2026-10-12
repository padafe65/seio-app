-- Reusable teacher-authored improvement plan templates by course and phase.
-- Apply to seio_db_pruebas first. Promote to seio_db only after validation.
CREATE TABLE IF NOT EXISTS phase_improvement_plan_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  teacher_id INT NOT NULL,
  course_id INT NOT NULL,
  phase TINYINT UNSIGNED NOT NULL,
  academic_year SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(150) NOT NULL,
  description TEXT NULL,
  activities MEDIUMTEXT NOT NULL,
  deadline_days TINYINT UNSIGNED NOT NULL DEFAULT 14,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_phase_plan_template (teacher_id, course_id, phase, academic_year),
  KEY idx_phase_plan_template_course (course_id, phase, academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student submissions are separate from file_url, which remains a plan resource.
ALTER TABLE improvement_plans ADD COLUMN submission_status VARCHAR(30) NOT NULL DEFAULT 'pending';
ALTER TABLE improvement_plans ADD COLUMN submission_text MEDIUMTEXT NULL;
ALTER TABLE improvement_plans ADD COLUMN submission_url TEXT NULL;
ALTER TABLE improvement_plans ADD COLUMN submitted_at DATETIME NULL;
ALTER TABLE improvement_plans ADD COLUMN submission_feedback TEXT NULL;
ALTER TABLE improvement_plans ADD COLUMN reviewed_at DATETIME NULL;
