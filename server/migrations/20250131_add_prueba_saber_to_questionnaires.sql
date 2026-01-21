-- =====================================================
-- MIGRACIÓN: Agregar soporte para Prueba Saber en cuestionarios
-- Fecha: 2025-01-31
-- Descripción: Permite marcar cuestionarios como tipo Prueba Saber
--              Los resultados de estos NO se promedian en las notas de fase
-- =====================================================

-- PASO 1: Agregar campo para indicar si el cuestionario es tipo Prueba Saber
ALTER TABLE questionnaires 
ADD COLUMN is_prueba_saber BOOLEAN DEFAULT FALSE 
COMMENT 'Indica si el cuestionario es tipo Prueba Saber. Los resultados NO se promedian en las notas de fase' 
AFTER description;

-- PASO 2: Agregar campo para el nivel de Prueba Saber en cuestionarios (3, 5, 9 o 11)
ALTER TABLE questionnaires 
ADD COLUMN prueba_saber_level INT NULL 
COMMENT 'Nivel de Prueba Saber del cuestionario: 3, 5, 9 o 11' 
AFTER is_prueba_saber;

-- PASO 3: Agregar índice para búsquedas eficientes de cuestionarios Prueba Saber
ALTER TABLE questionnaires
ADD INDEX idx_prueba_saber_questionnaire (is_prueba_saber, prueba_saber_level);

-- PASO 4: Agregar constraint para validar que solo acepte valores válidos (3, 5, 9, 11)
ALTER TABLE questionnaires
ADD CONSTRAINT chk_questionnaire_prueba_saber_level 
CHECK (prueba_saber_level IS NULL OR prueba_saber_level IN (3, 5, 9, 11));

-- =====================================================
-- VERIFICACIÓN: Ejecuta estas consultas después para verificar
-- =====================================================

-- Verificar estructura de questionnaires:
-- DESCRIBE questionnaires;

-- Verificar que los índices se crearon correctamente:
-- SHOW INDEX FROM questionnaires WHERE Column_name IN ('is_prueba_saber', 'prueba_saber_level');

-- =====================================================
