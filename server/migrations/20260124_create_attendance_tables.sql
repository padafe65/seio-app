-- Control de asistencia: sesiones y registros.
-- Sesiones tienen token (QR) y short_code (código manual). Estudiantes marcan por QR o el profesor registra manual por grado/curso.
--
-- Ejecutar: mysql -u USER -p seio_db < server/migrations/20260124_create_attendance_tables.sql

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  teacher_id INT NOT NULL COMMENT 'teachers.id',
  name VARCHAR(120) DEFAULT NULL COMMENT 'Ej. Matemáticas 15/02, 3ra hora',
  session_date DATE NOT NULL,
  grade VARCHAR(20) DEFAULT NULL COMMENT 'Filtro opcional por grado',
  course_id INT DEFAULT NULL COMMENT 'Filtro opcional por course',
  token VARCHAR(64) NOT NULL COMMENT 'Token único para QR / validate',
  short_code VARCHAR(12) NOT NULL COMMENT 'Código corto para ingreso manual',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_token (token),
  UNIQUE KEY uk_short_code (short_code),
  KEY idx_teacher (teacher_id),
  KEY idx_expires (expires_at),
  KEY idx_session_date (session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id INT UNSIGNED NOT NULL,
  student_id INT NOT NULL,
  status ENUM('present','absent') NOT NULL DEFAULT 'present',
  source ENUM('manual','qr') NOT NULL DEFAULT 'manual',
  registered_at DATETIME NOT NULL DEFAULT (NOW()),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_session_student (session_id, student_id),
  KEY idx_session (session_id),
  KEY idx_student (student_id),
  CONSTRAINT fk_ar_session FOREIGN KEY (session_id) REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
