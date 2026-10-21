-- Códigos de autoservicio para matrícula a cursos Preicfes.
CREATE TABLE IF NOT EXISTS prueba_saber_enrollment_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code_hash CHAR(64) NOT NULL UNIQUE,
  course_id INT NOT NULL,
  created_by_user_id INT NOT NULL,
  max_uses INT NULL,
  use_count INT NOT NULL DEFAULT 0,
  expires_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_psec_course_active (course_id, active),
  INDEX idx_psec_creator (created_by_user_id)
);
