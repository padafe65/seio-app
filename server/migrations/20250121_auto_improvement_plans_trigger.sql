-- =====================================================
-- TRIGGER AUTOMÁTICO PARA PLANES DE MEJORAMIENTO
-- =====================================================
-- Este trigger se ejecuta automáticamente cuando se actualiza
-- la tabla evaluation_results y crea planes de mejoramiento
-- para estudiantes que no alcanzaron los indicadores requeridos

DELIMITER $$

-- Trigger que se ejecuta después de actualizar evaluation_results
CREATE TRIGGER tr_auto_improvement_plans_after_evaluation_update
AFTER UPDATE ON evaluation_results
FOR EACH ROW
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_indicator_id INT;
    DECLARE v_passing_score DECIMAL(5,2);
    DECLARE v_achieved TINYINT;
    DECLARE v_failed_count INT DEFAULT 0;
    DECLARE v_teacher_id INT;
    DECLARE v_questionnaire_title VARCHAR(200);
    DECLARE v_student_name VARCHAR(100);
    DECLARE v_student_grade VARCHAR(20);
    DECLARE v_student_email VARCHAR(100);
    DECLARE v_subject VARCHAR(100);
    DECLARE v_plan_id INT;
    
    DECLARE indicator_cursor CURSOR FOR
        SELECT qi.indicator_id, qi.passing_score
        FROM questionnaire_indicators qi
        WHERE qi.questionnaire_id = NEW.questionnaire_id;
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Solo procesar si la nota cambió y es menor a 3.5 (nota mínima general)
    IF OLD.best_score != NEW.best_score AND NEW.best_score < 3.5 THEN
        
        -- Obtener información del cuestionario y profesor
        SELECT q.created_by, q.title, q.subject
        INTO v_teacher_id, v_questionnaire_title, v_subject
        FROM questionnaires q
        WHERE q.id = NEW.questionnaire_id;
        
        -- Obtener información del estudiante
        SELECT us.name, s.grade, s.contact_email
        INTO v_student_name, v_student_grade, v_student_email
        FROM students s
        JOIN users us ON s.user_id = us.id
        WHERE s.id = NEW.student_id;
        
        -- Verificar si ya existe un plan de mejoramiento para este estudiante y cuestionario
        SELECT COUNT(*) INTO @existing_plan_count
        FROM improvement_plans ip
        WHERE ip.student_id = NEW.student_id 
          AND ip.title LIKE CONCAT('%', v_questionnaire_title, '%')
          AND ip.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY);
        
        -- Solo crear plan si no existe uno reciente
        IF @existing_plan_count = 0 THEN
            
            -- Contar indicadores fallidos
            OPEN indicator_cursor;
            
            read_loop: LOOP
                FETCH indicator_cursor INTO v_indicator_id, v_passing_score;
                IF done THEN
                    LEAVE read_loop;
                END IF;
                
                -- Verificar si el indicador fue aprobado
                IF NEW.best_score < v_passing_score THEN
                    SET v_failed_count = v_failed_count + 1;
                END IF;
                
            END LOOP;
            
            CLOSE indicator_cursor;
            
            -- Solo crear plan si hay indicadores fallidos
            IF v_failed_count > 0 THEN
                
                -- Crear el plan de mejoramiento automático
                INSERT INTO improvement_plans (
                    student_id, 
                    teacher_id, 
                    title, 
                    subject, 
                    description, 
                    activities,
                    deadline, 
                    failed_achievements, 
                    activity_status, 
                    teacher_notes,
                    created_at
                ) VALUES (
                    NEW.student_id,
                    v_teacher_id,
                    CONCAT('Plan de Recuperación Automático - ', v_subject, ' - ', v_student_name),
                    v_subject,
                    CONCAT(
                        'Plan de recuperación académica generado automáticamente para ', v_student_name, 
                        ' del grado ', v_student_grade, '.\n\n',
                        '**Situación:**\n',
                        '• Cuestionario: ', v_questionnaire_title, '\n',
                        '• Materia: ', v_subject, '\n',
                        '• Nota obtenida: ', NEW.best_score, '\n',
                        '• Indicadores no alcanzados: ', v_failed_count, '\n\n',
                        '**Objetivo:**\n',
                        'Reforzar los conocimientos para alcanzar los indicadores de logro requeridos.\n\n',
                        '**Actividades:**\n',
                        '• Revisión de conceptos fundamentales\n',
                        '• Ejercicios prácticos específicos\n',
                        '• Evaluación de refuerzo\n',
                        '• Consulta con el docente\n',
                        '• Entrega de trabajos complementarios'
                    ),
                    CONCAT(
                        '**Actividades de Recuperación:**\n',
                        '1. Revisión de conceptos fundamentales de ', v_subject, '\n',
                        '2. Ejercicios prácticos específicos\n',
                        '3. Evaluación de refuerzo\n',
                        '4. Consulta con el docente\n',
                        '5. Entrega de trabajos complementarios\n',
                        '6. Evaluación final de recuperación'
                    ),
                    DATE_ADD(NOW(), INTERVAL 14 DAY),
                    CONCAT('El estudiante no alcanzó ', v_failed_count, ' indicadores en el cuestionario "', v_questionnaire_title, '" con una nota de ', NEW.best_score),
                    'pending',
                    CONCAT(
                        'Plan generado automáticamente el ', DATE_FORMAT(NOW(), '%d/%m/%Y'), 
                        ' debido a indicadores no alcanzados en el cuestionario "', v_questionnaire_title, '".\n',
                        'Nota obtenida: ', NEW.best_score, '\n',
                        'Indicadores no alcanzados: ', v_failed_count, '\n\n',
                        'Se recomienda seguimiento personalizado y evaluación de refuerzo.'
                    ),
                    NOW()
                );
                
                -- Obtener el ID del plan creado
                SET v_plan_id = LAST_INSERT_ID();
                
                -- Crear recursos automáticos básicos
                INSERT INTO recovery_resources (
                    improvement_plan_id, 
                    resource_type, 
                    title, 
                    description, 
                    url,
                    difficulty_level, 
                    order_index, 
                    is_required, 
                    created_at
                ) VALUES 
                (
                    v_plan_id,
                    'video',
                    CONCAT('Video educativo - ', v_subject),
                    CONCAT('Recurso multimedia para reforzar conceptos básicos de ', v_subject),
                    CASE v_subject
                        WHEN 'Español' THEN 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                        WHEN 'Matemáticas' THEN 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                        WHEN 'Física' THEN 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                        WHEN 'Química' THEN 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                        WHEN 'Biología' THEN 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                        ELSE 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                    END,
                    'basic',
                    1,
                    1,
                    NOW()
                ),
                (
                    v_plan_id,
                    'document',
                    CONCAT('Guía de estudio - ', v_subject),
                    CONCAT('Material de apoyo con ejercicios y explicaciones detalladas de ', v_subject),
                    CASE v_subject
                        WHEN 'Español' THEN 'https://www.ejemplo.com/documentos/espanol.pdf'
                        WHEN 'Matemáticas' THEN 'https://www.ejemplo.com/documentos/matematicas.pdf'
                        WHEN 'Física' THEN 'https://www.ejemplo.com/documentos/fisica.pdf'
                        WHEN 'Química' THEN 'https://www.ejemplo.com/documentos/quimica.pdf'
                        WHEN 'Biología' THEN 'https://www.ejemplo.com/documentos/biologia.pdf'
                        ELSE 'https://www.ejemplo.com/documentos/general.pdf'
                    END,
                    'basic',
                    2,
                    1,
                    NOW()
                ),
                (
                    v_plan_id,
                    'link',
                    CONCAT('Recursos adicionales - ', v_subject),
                    CONCAT('Enlaces a sitios web educativos especializados en ', v_subject),
                    CASE v_subject
                        WHEN 'Español' THEN 'https://www.rae.es/'
                        WHEN 'Matemáticas' THEN 'https://www.khanacademy.org/math'
                        WHEN 'Física' THEN 'https://www.physicsclassroom.com/'
                        WHEN 'Química' THEN 'https://www.chemguide.co.uk/'
                        WHEN 'Biología' THEN 'https://www.biologycorner.com/'
                        ELSE 'https://www.educacion.gob.es/'
                    END,
                    'intermediate',
                    3,
                    1,
                    NOW()
                );
                
                -- Crear actividad de evaluación de refuerzo
                INSERT INTO recovery_activities (
                    improvement_plan_id, 
                    questionnaire_id, 
                    activity_type,
                    title, 
                    description, 
                    instructions, 
                    due_date, 
                    max_attempts,
                    passing_score, 
                    weight, 
                    status, 
                    created_at
                ) VALUES (
                    v_plan_id,
                    NEW.questionnaire_id,
                    'quiz',
                    CONCAT('Evaluación de recuperación - ', v_questionnaire_title),
                    CONCAT('Evaluación de refuerzo para verificar el logro de los indicadores en ', v_subject),
                    CONCAT(
                        'Realizar la evaluación con calma y aplicar los conocimientos reforzados durante el plan de recuperación.\n',
                        'Esta evaluación tiene como objetivo verificar que se han alcanzado los indicadores requeridos.\n',
                        'Se recomienda revisar el material de apoyo antes de realizar la evaluación.'
                    ),
                    DATE_ADD(NOW(), INTERVAL 14 DAY),
                    2,
                    3.5,
                    2.00,
                    'pending',
                    NOW()
                );
                
                -- Registrar en auditoría
                INSERT INTO auditoria_indicadores (
                    accion, 
                    tabla, 
                    id_registro, 
                    usuario, 
                    valores_nuevos,
                    fecha
                ) VALUES (
                    'INSERT',
                    'improvement_plans',
                    v_plan_id,
                    'SISTEMA_AUTOMATICO',
                    CONCAT(
                        'student_id: ', NEW.student_id,
                        ', teacher_id: ', v_teacher_id,
                        ', questionnaire_id: ', NEW.questionnaire_id,
                        ', failed_indicators: ', v_failed_count,
                        ', student_score: ', NEW.best_score,
                        ', auto_generated: true'
                    ),
                    NOW()
                );
                
            END IF;
            
        END IF;
        
    END IF;
    
END$$

DELIMITER ;

-- =====================================================
-- PROCEDIMIENTO PARA PROCESAR CUESTIONARIOS MANUALMENTE
-- =====================================================
-- Este procedimiento permite procesar manualmente todos los
-- resultados de un cuestionario para crear planes de mejoramiento

DELIMITER $$

CREATE PROCEDURE sp_process_questionnaire_improvement_plans(
    IN p_questionnaire_id INT
)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_student_id INT;
    DECLARE v_best_score DECIMAL(5,2);
    DECLARE v_plans_created INT DEFAULT 0;
    
    DECLARE student_cursor CURSOR FOR
        SELECT er.student_id, er.best_score
        FROM evaluation_results er
        WHERE er.questionnaire_id = p_questionnaire_id
          AND er.best_score < 3.5;
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Verificar que el cuestionario existe
    IF NOT EXISTS (SELECT 1 FROM questionnaires WHERE id = p_questionnaire_id) THEN
        SELECT 'ERROR: Cuestionario no encontrado' as result;
        LEAVE sp_process_questionnaire_improvement_plans;
    END IF;
    
    -- Procesar cada estudiante con nota menor a 3.5
    OPEN student_cursor;
    
    read_loop: LOOP
        FETCH student_cursor INTO v_student_id, v_best_score;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Verificar si ya existe un plan reciente para este estudiante
        IF NOT EXISTS (
            SELECT 1 FROM improvement_plans ip
            WHERE ip.student_id = v_student_id 
              AND ip.title LIKE CONCAT('%Cuestionario ', p_questionnaire_id, '%')
              AND ip.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ) THEN
            
            -- Simular actualización para activar el trigger
            UPDATE evaluation_results 
            SET best_score = v_best_score 
            WHERE student_id = v_student_id 
              AND questionnaire_id = p_questionnaire_id;
            
            SET v_plans_created = v_plans_created + 1;
            
        END IF;
        
    END LOOP;
    
    CLOSE student_cursor;
    
    -- Retornar resultado
    SELECT CONCAT('Procesados ', v_plans_created, ' estudiantes para el cuestionario ', p_questionnaire_id) as result;
    
END$$

DELIMITER ;

-- =====================================================
-- VISTA PARA MONITOREAR PLANES AUTOMÁTICOS
-- =====================================================
-- Esta vista permite monitorear los planes de mejoramiento
-- generados automáticamente

CREATE VIEW v_automatic_improvement_plans AS
SELECT 
    ip.id as plan_id,
    ip.title,
    ip.subject,
    ip.activity_status,
    ip.created_at,
    ip.deadline,
    us.name as student_name,
    s.grade,
    s.contact_email,
    ut.name as teacher_name,
    q.title as questionnaire_title,
    q.id as questionnaire_id,
    er.best_score as student_score,
    CASE 
        WHEN ip.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 'RECIENTE'
        WHEN ip.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'ACTIVO'
        ELSE 'ANTIGUO'
    END as plan_age,
    DATEDIFF(ip.deadline, NOW()) as days_remaining
FROM improvement_plans ip
JOIN students s ON ip.student_id = s.id
JOIN users us ON s.user_id = us.id
JOIN teachers t ON ip.teacher_id = t.id
JOIN users ut ON t.user_id = ut.id
LEFT JOIN questionnaires q ON ip.title LIKE CONCAT('%', q.title, '%')
LEFT JOIN evaluation_results er ON er.student_id = s.id AND er.questionnaire_id = q.id
WHERE ip.teacher_notes LIKE '%generado automáticamente%'
ORDER BY ip.created_at DESC;

-- =====================================================
-- ÍNDICES PARA OPTIMIZAR CONSULTAS
-- =====================================================

-- Índice para búsquedas por estudiante y cuestionario
CREATE INDEX idx_improvement_plans_student_questionnaire 
ON improvement_plans(student_id, created_at);

-- Índice para búsquedas por profesor y estado
CREATE INDEX idx_improvement_plans_teacher_status 
ON improvement_plans(teacher_id, activity_status);

-- Índice para búsquedas por fecha de creación
CREATE INDEX idx_improvement_plans_created_at 
ON improvement_plans(created_at);

-- Índice para búsquedas por fecha límite
CREATE INDEX idx_improvement_plans_deadline 
ON improvement_plans(deadline);

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
-- 
-- Este sistema automático:
-- 1. Se activa cuando se actualiza evaluation_results
-- 2. Verifica si el estudiante tiene nota menor a 3.5
-- 3. Cuenta los indicadores no alcanzados
-- 4. Crea automáticamente un plan de mejoramiento
-- 5. Genera recursos y actividades específicas
-- 6. Registra todo en auditoría
-- 
-- Para usar manualmente:
-- CALL sp_process_questionnaire_improvement_plans(questionnaire_id);
-- 
-- Para monitorear:
-- SELECT * FROM v_automatic_improvement_plans;
--