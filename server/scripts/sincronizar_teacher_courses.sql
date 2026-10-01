-- SEIO / seio_db
-- Este script NO crea cuentas ni docentes nuevos. Copia a teacher_courses
-- las asignaciones principales que ya están declaradas en courses.teacher_id.
-- Ejecutar primero el SELECT de revisión y comprobar institución/docente/curso.

USE seio_db;

-- 1) Revisar las asociaciones declaradas en courses.teacher_id.
-- Las filas marcadas "PENDIENTE" son las que agregaría el INSERT de abajo.
SELECT
    c.id AS course_id,
    c.name AS course_name,
    c.grade,
    c.institution AS course_institution,
    c.teacher_id,
    u.name AS teacher_name,
    t.subject AS teacher_subject,
    t.institution AS teacher_institution,
    CASE
        WHEN tc.id IS NULL THEN 'PENDIENTE: se agregaría'
        ELSE 'Ya existe en teacher_courses'
    END AS assignment_status
FROM courses c
JOIN teachers t ON t.id = c.teacher_id
JOIN users u ON u.id = t.user_id
LEFT JOIN teacher_courses tc
    ON tc.teacher_id = c.teacher_id
   AND tc.course_id = c.id
WHERE c.teacher_id IS NOT NULL
ORDER BY c.institution, c.grade, c.name;

-- 2) Ejecutar después de revisar el resultado anterior.
-- Es idempotente: no duplica pares docente/curso ya existentes.
START TRANSACTION;

INSERT INTO teacher_courses
    (teacher_id, course_id, academic_year, assigned_date, role)
SELECT
    c.teacher_id,
    c.id,
    YEAR(CURDATE()),
    CURDATE(),
    'principal'
FROM courses c
JOIN teachers t ON t.id = c.teacher_id
WHERE c.teacher_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM teacher_courses tc
      WHERE tc.teacher_id = c.teacher_id
        AND tc.course_id = c.id
  );

COMMIT;

-- 3) Verificar las relaciones resultantes.
SELECT
    c.id AS course_id,
    c.name AS course_name,
    c.grade,
    c.institution AS course_institution,
    t.id AS teacher_id,
    u.name AS teacher_name,
    t.subject AS teacher_subject,
    tc.role,
    tc.academic_year
FROM teacher_courses tc
JOIN courses c ON c.id = tc.course_id
JOIN teachers t ON t.id = tc.teacher_id
JOIN users u ON u.id = t.user_id
ORDER BY c.institution, c.grade, c.name, u.name;
