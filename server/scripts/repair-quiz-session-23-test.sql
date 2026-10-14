-- Recupera el intento que falta para la sesión 23 del estudiante 27.
-- Específico para el respaldo seio_db_pruebas revisado el 2026-10-13.
-- No ejecutar en la base real ni si cambió la sesión/respuestas.
USE seio_db_pruebas;

START TRANSACTION;

-- Las respuestas guardadas en la sesión 23 obtienen 2.00/5 según las claves
-- actuales de las cinco preguntas del cuestionario 11.
INSERT INTO quiz_attempts (
  student_id,
  questionnaire_id,
  quiz_session_id,
  attempt_number,
  score,
  phase,
  academic_year
)
SELECT 27, 11, 23, 1, 2.00, 1, 2026
WHERE NOT EXISTS (
  SELECT 1 FROM quiz_attempts
  WHERE student_id = 27 AND questionnaire_id = 11 AND attempt_number = 1
);

SET @recovered_attempt_id := (
  SELECT id FROM quiz_attempts
  WHERE student_id = 27 AND questionnaire_id = 11 AND attempt_number = 1
  LIMIT 1
);

-- El respaldo tiene evaluation_results.selected_attempt_id apuntando al intento
-- 25, que pertenece a otro estudiante; lo reasocia al intento restaurado.
UPDATE evaluation_results
SET selected_attempt_id = @recovered_attempt_id
WHERE student_id = 27
  AND questionnaire_id = 11
  AND academic_year = 2026
  AND best_score = 2.00
  AND @recovered_attempt_id IS NOT NULL;

COMMIT;

SELECT qa.id AS recovered_attempt_id, qa.student_id, qa.questionnaire_id,
       qa.quiz_session_id, qa.attempt_number, qa.score, qa.phase, qa.academic_year,
       er.selected_attempt_id AS linked_result_attempt_id
FROM quiz_attempts qa
LEFT JOIN evaluation_results er
  ON er.student_id = qa.student_id
 AND er.questionnaire_id = qa.questionnaire_id
 AND er.academic_year = qa.academic_year
WHERE qa.student_id = 27 AND qa.questionnaire_id = 11
  AND qa.quiz_session_id = 23 AND qa.attempt_number = 1;
