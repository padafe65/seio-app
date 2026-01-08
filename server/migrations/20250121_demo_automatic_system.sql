-- =====================================================
-- SCRIPT DE DEMOSTRACIÓN DEL SISTEMA AUTOMÁTICO
-- =====================================================
-- Este script crea datos de prueba para demostrar el funcionamiento
-- del sistema automático de planes de mejoramiento

-- 1. Crear un cuestionario de prueba
INSERT INTO questionnaires (title, category, subject, grade, phase, created_by, description) 
VALUES (
    'Evaluación de Prueba - Sistema Automático',
    'Prueba',
    'Matemáticas',
    11,
    1,
    1, -- Profesor ID 1
    'Cuestionario de prueba para demostrar el sistema automático'
);

-- Obtener el ID del cuestionario creado
SET @questionnaire_id = LAST_INSERT_ID();

-- 2. Crear indicadores de prueba
INSERT INTO indicators (teacher_id, description, subject, category, grade, phase, questionnaire_id) 
VALUES 
(1, 'El estudiante resuelve ecuaciones de primer grado correctamente', 'Matemáticas', 'Álgebra', 11, 1, @questionnaire_id),
(1, 'El estudiante aplica propiedades de los números reales', 'Matemáticas', 'Aritmética', 11, 1, @questionnaire_id),
(1, 'El estudiante interpreta gráficas de funciones lineales', 'Matemáticas', 'Geometría', 11, 1, @questionnaire_id);

-- 3. Crear preguntas de prueba
INSERT INTO questions (questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category) 
VALUES 
(@questionnaire_id, '¿Cuál es la solución de la ecuación 2x + 5 = 13?', 'x = 4', 'x = 3', 'x = 5', 'x = 6', 1, 'Matemáticas'),
(@questionnaire_id, '¿Cuál es el resultado de 3 + 4 × 2?', '14', '11', '10', '12', 2, 'Matemáticas'),
(@questionnaire_id, '¿Cuál es la pendiente de la recta y = 2x + 3?', '2', '3', '1', '0', 1, 'Matemáticas');

-- 4. Crear indicadores de cuestionario con notas mínimas
INSERT INTO questionnaire_indicators (questionnaire_id, indicator_id, weight, passing_score) 
SELECT @questionnaire_id, id, 1.00, 3.5 
FROM indicators 
WHERE questionnaire_id = @questionnaire_id;

-- 5. Crear intentos de cuestionario con notas bajas para algunos estudiantes
-- Estudiante ID 5 (Pedro Hernández) - Nota baja
INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score, phase) 
VALUES (5, @questionnaire_id, 1, 2.8, 1);

-- Estudiante ID 8 (Milán Santiago Tobón) - Nota baja
INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score, phase) 
VALUES (8, @questionnaire_id, 1, 2.5, 1);

-- Estudiante ID 9 (David Sebastian Ferreira) - Nota baja
INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score, phase) 
VALUES (9, @questionnaire_id, 1, 3.0, 1);

-- 6. Crear resultados de evaluación con notas bajas
INSERT INTO evaluation_results (student_id, questionnaire_id, best_score, selected_attempt_id, phase) 
SELECT 
    qa.student_id,
    qa.questionnaire_id,
    qa.score,
    qa.id,
    qa.phase
FROM quiz_attempts qa
WHERE qa.questionnaire_id = @questionnaire_id;

-- 7. Actualizar los resultados para activar el trigger automático
UPDATE evaluation_results 
SET best_score = best_score 
WHERE questionnaire_id = @questionnaire_id;

-- 8. Verificar que se crearon los planes automáticos
SELECT 
    'PLANES AUTOMÁTICOS CREADOS' as resultado,
    COUNT(*) as total_planes
FROM improvement_plans 
WHERE teacher_notes LIKE '%generado automáticamente%'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- 9. Mostrar detalles de los planes creados
SELECT 
    ip.id as plan_id,
    ip.title,
    ip.subject,
    ip.activity_status,
    us.name as student_name,
    s.grade,
    ut.name as teacher_name,
    ip.created_at
FROM improvement_plans ip
JOIN students s ON ip.student_id = s.id
JOIN users us ON s.user_id = us.id
JOIN teachers t ON ip.teacher_id = t.id
JOIN users ut ON t.user_id = ut.id
WHERE ip.teacher_notes LIKE '%generado automáticamente%'
  AND ip.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY ip.created_at DESC;

-- 10. Mostrar recursos automáticos creados
SELECT 
    'RECURSOS AUTOMÁTICOS CREADOS' as resultado,
    COUNT(*) as total_recursos
FROM recovery_resources rr
JOIN improvement_plans ip ON rr.improvement_plan_id = ip.id
WHERE ip.teacher_notes LIKE '%generado automáticamente%'
  AND rr.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- 11. Mostrar actividades automáticas creadas
SELECT 
    'ACTIVIDADES AUTOMÁTICAS CREADAS' as resultado,
    COUNT(*) as total_actividades
FROM recovery_activities ra
JOIN improvement_plans ip ON ra.improvement_plan_id = ip.id
WHERE ip.teacher_notes LIKE '%generado automáticamente%'
  AND ra.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- 12. Mostrar detalles de recursos creados
SELECT 
    rr.id as resource_id,
    rr.title,
    rr.resource_type,
    rr.difficulty_level,
    rr.order_index,
    ip.title as plan_title,
    us.name as student_name
FROM recovery_resources rr
JOIN improvement_plans ip ON rr.improvement_plan_id = ip.id
JOIN students s ON ip.student_id = s.id
JOIN users us ON s.user_id = us.id
WHERE ip.teacher_notes LIKE '%generado automáticamente%'
  AND rr.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY rr.created_at DESC;

-- 13. Mostrar detalles de actividades creadas
SELECT 
    ra.id as activity_id,
    ra.title,
    ra.activity_type,
    ra.status,
    ra.due_date,
    ra.passing_score,
    ip.title as plan_title,
    us.name as student_name
FROM recovery_activities ra
JOIN improvement_plans ip ON ra.improvement_plan_id = ip.id
JOIN students s ON ip.student_id = s.id
JOIN users us ON s.user_id = us.id
WHERE ip.teacher_notes LIKE '%generado automáticamente%'
  AND ra.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY ra.created_at DESC;

-- 14. Estadísticas finales
SELECT 
    'ESTADÍSTICAS FINALES' as resultado,
    COUNT(DISTINCT ip.id) as planes_creados,
    COUNT(DISTINCT rr.id) as recursos_creados,
    COUNT(DISTINCT ra.id) as actividades_creadas,
    COUNT(DISTINCT ip.student_id) as estudiantes_afectados
FROM improvement_plans ip
LEFT JOIN recovery_resources rr ON rr.improvement_plan_id = ip.id
LEFT JOIN recovery_activities ra ON ra.improvement_plan_id = ip.id
WHERE ip.teacher_notes LIKE '%generado automáticamente%'
  AND ip.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- 15. Limpiar datos de prueba (opcional - comentar si se quiere mantener)
/*
DELETE FROM recovery_activities WHERE improvement_plan_id IN (
    SELECT id FROM improvement_plans WHERE teacher_notes LIKE '%generado automáticamente%'
    AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
);

DELETE FROM recovery_resources WHERE improvement_plan_id IN (
    SELECT id FROM improvement_plans WHERE teacher_notes LIKE '%generado automáticamente%'
    AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
);

DELETE FROM improvement_plans WHERE teacher_notes LIKE '%generado automáticamente%'
AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR);

DELETE FROM evaluation_results WHERE questionnaire_id = @questionnaire_id;
DELETE FROM quiz_attempts WHERE questionnaire_id = @questionnaire_id;
DELETE FROM questionnaire_indicators WHERE questionnaire_id = @questionnaire_id;
DELETE FROM questions WHERE questionnaire_id = @questionnaire_id;
DELETE FROM indicators WHERE questionnaire_id = @questionnaire_id;
DELETE FROM questionnaires WHERE id = @questionnaire_id;
*/

-- =====================================================
-- INSTRUCCIONES DE USO
-- =====================================================
-- 
-- 1. Ejecutar este script en la base de datos seio_db
-- 2. El sistema automáticamente creará planes de mejoramiento
-- 3. Verificar los resultados en las consultas de verificación
-- 4. Usar el componente frontend para monitorear el sistema
-- 
-- Para probar manualmente:
-- CALL sp_process_questionnaire_improvement_plans(@questionnaire_id);
--
-- Para ver la vista de monitoreo:
-- SELECT * FROM v_automatic_improvement_plans;
--
