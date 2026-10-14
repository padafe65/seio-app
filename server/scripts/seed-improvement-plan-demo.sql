-- Datos de demostración para probar el flujo docente -> estudiante -> revisión.
-- Deliberadamente fija la base de pruebas; no ejecutar en la base real.
USE seio_db_pruebas;

-- La fila se crea solo si existen las relaciones de prueba (docente 2 / estudiante 27)
-- y no existe ya este mismo registro de demostración.
INSERT INTO improvement_plans (
  student_id,
  teacher_id,
  title,
  subject,
  description,
  activities,
  deadline,
  file_url,
  failed_achievements,
  passed_achievements,
  completed,
  email_sent,
  created_at,
  academic_year,
  activity_status,
  teacher_notes,
  attempts_count,
  submission_status,
  physical_delivery_required
)
SELECT
  s.id,
  t.id,
  '[PRUEBA] Plan de mejoramiento de Español - Fase 1',
  'Español',
  'Registro de demostración para validar la publicación del PDF, la entrega del estudiante y la revisión docente. No corresponde a una calificación oficial.',
  '1. Descarga la guía PDF publicada por el docente.\n2. Resuelve los ejercicios en otro documento.\n3. Guarda tus respuestas como PDF y súbelas desde tu panel.\n4. Espera la revisión del docente.',
  DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 14 DAY), '%Y-%m-%d'),
  NULL,
  'Indicador de prueba: comprensión e interpretación de textos.',
  '',
  0,
  0,
  NOW(),
  YEAR(CURDATE()),
  'pending',
  'SEIO_TEST_PLAN_DEMO_20261013',
  0,
  'pending',
  0
FROM students s
JOIN teacher_students ts ON ts.student_id = s.id
JOIN teachers t ON t.id = ts.teacher_id
WHERE s.id = 27
  AND t.id = 2
  AND ts.academic_year = YEAR(CURDATE())
  AND NOT EXISTS (
    SELECT 1
    FROM improvement_plans existing
    WHERE existing.student_id = s.id
      AND existing.teacher_id = t.id
      AND existing.teacher_notes = 'SEIO_TEST_PLAN_DEMO_20261013'
  )
LIMIT 1;

-- Muestra el ID del plan que debes usar en la prueba.
SELECT id, student_id, teacher_id, title, subject, academic_year,
       submission_status, plan_pdf_path, physical_delivery_required
FROM improvement_plans
WHERE teacher_notes = 'SEIO_TEST_PLAN_DEMO_20261013';
