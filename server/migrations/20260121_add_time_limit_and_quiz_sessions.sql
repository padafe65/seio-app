-- =====================================================
-- MIGRACIÓN: Límite de tiempo por cuestionario + sesiones de evaluación
-- Fecha: 2026-01-21
-- Descripción:
--  - Agrega time_limit_minutes al cuestionario (configurable por docente)
--  - Crea quiz_sessions para fijar preguntas y controlar expires_at
-- =====================================================

-- 1) Campo de duración (minutos) en cuestionarios (NULL => sin límite)
ALTER TABLE questionnaires
ADD COLUMN time_limit_minutes INT NULL
COMMENT 'Duración máxima en minutos para presentar el cuestionario (NULL = sin límite)'
AFTER questions_to_answer;

-- 2) Tabla de sesiones (una sesión activa por estudiante/cuestionario/attempt_number)
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  questionnaire_id INT NOT NULL,
  attempt_number INT NOT NULL,
  academic_year INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- in_progress | submitted | expired | abandoned
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  question_ids_json TEXT NOT NULL,
  answers_json TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_quiz_sessions_student_questionnaire (student_id, questionnaire_id),
  INDEX idx_quiz_sessions_academic_year (academic_year),
  INDEX idx_quiz_sessions_status (status),
  INDEX idx_quiz_sessions_expires_at (expires_at)
);

-- Nota: si tu BD tiene FKs activas y quieres reforzar integridad, puedes agregar FKs manualmente.

