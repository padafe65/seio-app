-- =====================================================
-- MIGRACIÓN: course_id opcional + límite de preguntas
-- Fecha: 2026-01-21
-- Descripción:
--  - Permite que un cuestionario aplique a "Todos los cursos" del grado (course_id = NULL)
--  - Permite definir cuántas preguntas debe responder el estudiante (questions_to_answer)
-- =====================================================

-- PASO 1: Hacer course_id nullable (para "Todos los cursos")
-- Nota: Ajusta el tipo si tu columna difiere (aquí se asume INT).
ALTER TABLE questionnaires
MODIFY COLUMN course_id INT NULL;

-- PASO 2: Agregar campo para definir cuántas preguntas se responderán (NULL => todas)
ALTER TABLE questionnaires
ADD COLUMN questions_to_answer INT NULL
COMMENT 'Cantidad de preguntas que debe responder el estudiante. NULL = todas las preguntas asociadas al cuestionario'
AFTER course_id;

-- Índice opcional (si filtras/listas por este campo)
-- ALTER TABLE questionnaires ADD INDEX idx_questionnaires_questions_to_answer (questions_to_answer);

-- =====================================================
-- VERIFICACIÓN (opcional)
-- =====================================================
-- DESCRIBE questionnaires;

