-- Corregir incoherencia de phase: evaluation_results y phase_averages deben usar
-- la phase del cuestionario (questionnaires.phase), no valores obsoletos.
--
-- Caso: student_id=5, questionnaire_id=2 tiene phase=2 en questionnaires y
-- quiz_attempts, pero evaluation_results y phase_averages tenían phase=1.
--
-- Ejecutar manualmente si hace falta, p. ej.:
--   mysql -u USER -p seio_db < server/migrations/20260123_fix_phase_coherence_evaluation_results_phase_averages.sql

-- 1. Alinear evaluation_results.phase con questionnaires.phase
UPDATE evaluation_results er
INNER JOIN questionnaires q ON q.id = er.questionnaire_id
SET er.phase = q.phase
WHERE er.phase <> q.phase;

-- 2. Eliminar phase_averages huérfanos: (student_id, phase) que no tienen
--    ninguna evaluación en evaluation_results para esa phase (vía questionnaire).
DELETE pa FROM phase_averages pa
LEFT JOIN (
  SELECT DISTINCT er.student_id, q.phase
  FROM evaluation_results er
  INNER JOIN questionnaires q ON q.id = er.questionnaire_id
) x ON pa.student_id = x.student_id AND pa.phase = x.phase
WHERE x.student_id IS NULL;

-- 3. Opcional: después de ejecutar, correr recálculo para afectados.
--    Desde la app: POST /api/recalculate-phase-averages/:studentId
--    o POST /api/recalculate-phase-averages/teacher/:teacherId
