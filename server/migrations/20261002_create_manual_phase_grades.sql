-- Registros individuales de notas manuales por estudiante y fase.
-- Ejecutar en cada base (seio_db y seio_db_pruebas) después de seleccionar
-- esa base. La migración conserva las notas manuales agregadas existentes.

-- Una fila agregada de grades puede ser manual y no pertenecer a un cuestionario.
-- Se conserva la clave foránea y se admite NULL si no hay cuestionario de origen.
ALTER TABLE grades MODIFY questionnaire_id INT(11) NULL;

CREATE TABLE IF NOT EXISTS manual_phase_grades (
  id BIGINT NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  teacher_id INT NOT NULL,
  phase TINYINT UNSIGNED NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  assessment_date DATE DEFAULT NULL,
  entered_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_manual_phase_student_teacher (student_id, teacher_id, phase),
  KEY idx_manual_phase_teacher (teacher_id),
  KEY idx_manual_phase_entered_by (entered_by)
);

-- Copiar las notas manuales antiguas como un registro individual para que
-- sigan contando en el promedio al actualizar la aplicación.
INSERT INTO manual_phase_grades
  (student_id, teacher_id, phase, score, description, assessment_date, created_at)
SELECT
  pa.student_id,
  pa.teacher_id,
  pa.phase,
  pa.average_score_manual,
  'Nota manual existente antes del registro múltiple',
  CURRENT_DATE(),
  CURRENT_TIMESTAMP()
FROM phase_averages pa
WHERE pa.average_score_manual IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM manual_phase_grades mpg
    WHERE mpg.student_id = pa.student_id
      AND mpg.teacher_id = pa.teacher_id
      AND mpg.phase = pa.phase
  );
