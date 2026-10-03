-- Carga 10 estudiantes ficticios para probar las 4 fases en seio_db.
-- Ejecutar una sola vez, despuÃ©s de importar el respaldo.
-- Usa teacher_id=3; verifica el SELECT de abajo y detente si no es el docente deseado.
-- Las cuentas de estudiante quedan para pruebas de evaluaciÃ³n/correo; sus claves
-- deben definirse desde SEIO antes de probar el inicio de sesiÃ³n de estudiantes.

USE seio_db;

SET @test_teacher_id := 3;
SET @test_institution := 'Colegio La Chucua';
SET @test_course_id := NULL;
SET @test_questionnaire_id := (
  SELECT MIN(id)
  FROM questionnaires
  WHERE grade = 7 AND phase = 1 AND COALESCE(is_prueba_saber, 0) = 0
);

-- Verificar que el docente y el cuestionario de referencia existan en el respaldo.
SELECT t.id AS docente_prueba_id, u.name AS docente_prueba, u.email AS correo_docente
FROM teachers t
JOIN users u ON u.id = t.user_id
WHERE t.id = @test_teacher_id;

SELECT id AS cuestionario_referencia_id, title, grade, phase
FROM questionnaires
WHERE id = @test_questionnaire_id;

-- El curso nuevo queda asignado solo al docente de prueba.
INSERT INTO courses (name, grade, institution, teacher_id)
VALUES ('7A-PRUEBA', '7', @test_institution, @test_teacher_id);
SET @test_course_id := LAST_INSERT_ID();

INSERT INTO teacher_courses (teacher_id, course_id, academic_year, assigned_date, role)
VALUES (@test_teacher_id, @test_course_id, 2026, CURDATE(), 'principal');

-- Indicadores propios del curso, uno por fase.
INSERT INTO indicators
  (teacher_id, description, subject, category, grade, phase, course_id, institution)
VALUES
  (@test_teacher_id, 'Comprende conceptos fundamentales de matemÃ¡ticas.', 'MatemÃ¡ticas', 'ComprensiÃ³n', 7, 1, @test_course_id, @test_institution),
  (@test_teacher_id, 'Aplica procedimientos matemÃ¡ticos con precisiÃ³n.', 'MatemÃ¡ticas', 'Procedimientos', 7, 2, @test_course_id, @test_institution),
  (@test_teacher_id, 'Resuelve problemas y explica su estrategia.', 'MatemÃ¡ticas', 'ResoluciÃ³n de problemas', 7, 3, @test_course_id, @test_institution),
  (@test_teacher_id, 'Integra los aprendizajes del aÃ±o escolar.', 'MatemÃ¡ticas', 'IntegraciÃ³n', 7, 4, @test_course_id, @test_institution);

CREATE TEMPORARY TABLE test_phase_scores (
  student_no TINYINT NOT NULL PRIMARY KEY,
  phase1 DECIMAL(5,2) NOT NULL,
  phase2 DECIMAL(5,2) NOT NULL,
  phase3 DECIMAL(5,2) NOT NULL,
  phase4 DECIMAL(5,2) NOT NULL
);

INSERT INTO test_phase_scores (student_no, phase1, phase2, phase3, phase4) VALUES
  (1, 4.00, 4.00, 4.00, 4.00),
  (2, 4.20, 4.00, 3.80, 4.20),
  (3, 3.80, 4.10, 4.00, 4.10),
  (4, 4.50, 4.30, 4.20, 4.40),
  (5, 3.70, 3.90, 4.00, 4.10),
  (6, 4.10, 3.80, 4.20, 4.00),
  (7, 3.20, 3.80, 4.00, 4.00),
  (8, 2.80, 2.60, 2.90, 2.50),
  (9, 2.50, 2.90, 2.60, 2.80),
  (10, 2.90, 2.40, 2.80, 2.60);

-- Los correos .invalid son marcadores que no reciben mensajes.
-- Antes de probar envÃ­os, reemplaza users.email y students.contact_email
-- Ãºnicamente para estos 10 estudiantes por direcciones autorizadas.
INSERT INTO users (name, phone, institution, email, password, role, estado)
VALUES
  ('Prueba SEIO 01', '3000001001', @test_institution, 'seio-prueba-01@example.invalid', 'RESET_USING_ADMIN_PANEL', 'estudiante', 'activo'),
  ('Prueba SEIO 02', '3000001002', @test_institution, 'seio-prueba-02@example.invalid', 'RESET_USING_ADMIN_PANEL', 'estudiante', 'activo'),
  ('Prueba SEIO 03', '3000001003', @test_institution, 'seio-prueba-03@example.invalid', 'RESET_USING_ADMIN_PANEL', 'estudiante', 'activo'),
  ('Prueba SEIO 04', '3000001004', @test_institution, 'seio-prueba-04@example.invalid', 'RESET_USING_ADMIN_PANEL', 'estudiante', 'activo'),
  ('Prueba SEIO 05', '3000001005', @test_institution, 'seio-prueba-05@example.invalid', 'RESET_USING_ADMIN_PANEL', 'estudiante', 'activo'),
  ('Prueba SEIO 06', '3000001006', @test_institution, 'seio-prueba-06@example.invalid', 'RESET_USING_ADMIN_PANEL', 'estudiante', 'activo'),
  ('Prueba SEIO 07', '3000001007', @test_institution, 'seio-prueba-07@example.invalid', 'RESET_USING_ADMIN_PANEL', 'estudiante', 'activo'),
  ('Prueba SEIO 08', '3000001008', @test_institution, 'seio-prueba-08@example.invalid', 'RESET_USING_ADMIN_PANEL', 'estudiante', 'activo'),
  ('Prueba SEIO 09', '3000001009', @test_institution, 'seio-prueba-09@example.invalid', 'RESET_USING_ADMIN_PANEL', 'estudiante', 'activo'),
  ('Prueba SEIO 10', '3000001010', @test_institution, 'seio-prueba-10@example.invalid', 'RESET_USING_ADMIN_PANEL', 'estudiante', 'activo');

INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id, institution)
SELECT u.id, u.phone, u.email, 13, '7', @test_course_id, @test_institution
FROM users u
WHERE u.email IN (
  'seio-prueba-01@example.invalid', 'seio-prueba-02@example.invalid',
  'seio-prueba-03@example.invalid', 'seio-prueba-04@example.invalid',
  'seio-prueba-05@example.invalid', 'seio-prueba-06@example.invalid',
  'seio-prueba-07@example.invalid', 'seio-prueba-08@example.invalid',
  'seio-prueba-09@example.invalid', 'seio-prueba-10@example.invalid'
);

INSERT INTO teacher_students (teacher_id, student_id, academic_year)
SELECT @test_teacher_id, s.id, 2026
FROM students s
JOIN users u ON u.id = s.user_id
WHERE u.email LIKE 'seio-prueba-%@example.invalid'
  AND s.course_id = @test_course_id;

-- Una fila de calificaciones por estudiante con notas para las cuatro fases.
INSERT INTO grades (student_id, questionnaire_id, phase1, phase2, phase3, phase4, average, academic_year)
SELECT s.id, @test_questionnaire_id, p.phase1, p.phase2, p.phase3, p.phase4,
       ROUND((p.phase1 + p.phase2 + p.phase3 + p.phase4) / 4, 2), 2026
FROM test_phase_scores p
JOIN users u ON u.email = CONCAT('seio-prueba-', LPAD(p.student_no, 2, '0'), '@example.invalid')
JOIN students s ON s.user_id = u.id AND s.course_id = @test_course_id;

-- Vincular cada fase con su indicador; las notas bajo 3.5 quedan no alcanzadas.
INSERT INTO student_indicators (student_id, indicator_id, achieved, questionnaire_id)
SELECT s.id, i.id,
       CASE i.phase
         WHEN 1 THEN p.phase1 >= 3.5
         WHEN 2 THEN p.phase2 >= 3.5
         WHEN 3 THEN p.phase3 >= 3.5
         WHEN 4 THEN p.phase4 >= 3.5
       END,
       @test_questionnaire_id
FROM test_phase_scores p
JOIN users u ON u.email = CONCAT('seio-prueba-', LPAD(p.student_no, 2, '0'), '@example.invalid')
JOIN students s ON s.user_id = u.id AND s.course_id = @test_course_id
JOIN indicators i ON i.course_id = @test_course_id;

DROP TEMPORARY TABLE test_phase_scores;

-- Resultado esperado: 7 promedios definitivos >= 3.0 y 3 por debajo de 3.0.
SELECT u.name, g.phase1, g.phase2, g.phase3, g.phase4, g.average
FROM grades g
JOIN students s ON s.id = g.student_id AND s.course_id = @test_course_id
JOIN users u ON u.id = s.user_id
ORDER BY u.name;

