-- Aplicaciones de Prueba Saber con selección docente fija de preguntas.
-- Las calificaciones quedan aisladas del flujo de fases académicas.
CREATE TABLE IF NOT EXISTS prueba_saber_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  questionnaire_id INT NOT NULL,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  question_ids_json LONGTEXT NOT NULL,
  time_limit_minutes INT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by_user_id INT NOT NULL,
  institution VARCHAR(150) NOT NULL DEFAULT 'CRECER',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_psa_course_status (course_id, status),
  INDEX idx_psa_questionnaire (questionnaire_id)
);

CREATE TABLE IF NOT EXISTS prueba_saber_application_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  student_id INT NOT NULL,
  answers_json LONGTEXT NULL,
  score DECIMAL(5,2) NULL,
  correct_count INT NULL,
  total_questions INT NOT NULL,
  status ENUM('in_progress','submitted','expired') NOT NULL DEFAULT 'in_progress',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  submitted_at DATETIME NULL,
  UNIQUE KEY uq_psaa_student_application (student_id, application_id),
  INDEX idx_psaa_application (application_id),
  INDEX idx_psaa_student (student_id)
);

-- Matrícula adicional a cursos Preicfes; no reemplaza students.course_id ni
-- la institución de procedencia guardada en el perfil del estudiante.
CREATE TABLE IF NOT EXISTS prueba_saber_course_enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  provider_institution VARCHAR(150) NOT NULL DEFAULT 'CRECER',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_psce_student_course (student_id, course_id),
  INDEX idx_psce_course_status (course_id, status)
);
