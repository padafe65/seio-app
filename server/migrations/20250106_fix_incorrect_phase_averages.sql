-- Migración para corregir valores incorrectos en phase_averages y grades
-- Fecha: 2025-01-06
-- Descripción: Corrige valores que están en escala incorrecta (40.00 -> 4.00)

-- Corregir phase_averages: Si el valor está entre 5 y 50, dividir por 10
-- Si es mayor a 50, establecer como NULL para que se recalcule
UPDATE phase_averages
SET average_score = CASE
    WHEN average_score > 5 AND average_score <= 50 THEN ROUND(average_score / 10, 2)
    WHEN average_score > 50 THEN NULL
    ELSE average_score
END
WHERE average_score > 5;

-- Corregir grades: phase1, phase2, phase3, phase4, average
UPDATE grades
SET 
    phase1 = CASE
        WHEN phase1 > 5 AND phase1 <= 50 THEN ROUND(phase1 / 10, 2)
        WHEN phase1 > 50 THEN NULL
        ELSE phase1
    END,
    phase2 = CASE
        WHEN phase2 > 5 AND phase2 <= 50 THEN ROUND(phase2 / 10, 2)
        WHEN phase2 > 50 THEN NULL
        ELSE phase2
    END,
    phase3 = CASE
        WHEN phase3 > 5 AND phase3 <= 50 THEN ROUND(phase3 / 10, 2)
        WHEN phase3 > 50 THEN NULL
        ELSE phase3
    END,
    phase4 = CASE
        WHEN phase4 > 5 AND phase4 <= 50 THEN ROUND(phase4 / 10, 2)
        WHEN phase4 > 50 THEN NULL
        ELSE phase4
    END,
    average = CASE
        WHEN average > 5 AND average <= 50 THEN ROUND(average / 10, 2)
        WHEN average > 50 THEN NULL
        ELSE average
    END
WHERE phase1 > 5 OR phase2 > 5 OR phase3 > 5 OR phase4 > 5 OR average > 5;

-- Verificar los cambios
SELECT 
    'phase_averages' as tabla,
    COUNT(*) as registros_corregidos
FROM phase_averages
WHERE average_score > 5
UNION ALL
SELECT 
    'grades' as tabla,
    COUNT(*) as registros_corregidos
FROM grades
WHERE phase1 > 5 OR phase2 > 5 OR phase3 > 5 OR phase4 > 5 OR average > 5;

-- Mostrar el registro específico del estudiante 30 para verificar
SELECT * FROM phase_averages WHERE student_id = 30;
SELECT * FROM grades WHERE student_id = 30;



