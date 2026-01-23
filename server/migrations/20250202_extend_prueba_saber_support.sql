-- =====================================================
-- MIGRACIÓN: Extender soporte para Prueba Saber
-- Fecha: 2025-02-02
-- Descripción: Agregar soporte para grado 7 y tipos de Prueba Saber (Pro, TyT)
-- =====================================================

-- PASO 1: Eliminar constraint anterior que solo permitía 3, 5, 9, 11
ALTER TABLE questionnaires
DROP CONSTRAINT IF EXISTS chk_questionnaire_prueba_saber_level;

-- PASO 2: Agregar nuevo constraint que incluya grado 7 y además 3, 5, 9, 11
ALTER TABLE questionnaires
ADD CONSTRAINT chk_questionnaire_prueba_saber_level 
CHECK (prueba_saber_level IS NULL OR prueba_saber_level IN (3, 5, 7, 9, 11));

-- PASO 3: Agregar campo para tipo de Prueba Saber (11, Pro, TyT)
ALTER TABLE questionnaires 
ADD COLUMN prueba_saber_type VARCHAR(20) NULL 
COMMENT 'Tipo de Prueba Saber: "11" (grado 11), "Pro", "TyT"' 
AFTER prueba_saber_level;

-- PASO 4: Agregar el mismo soporte en la tabla questions
ALTER TABLE questions
DROP CONSTRAINT IF EXISTS chk_prueba_saber_level;

ALTER TABLE questions
ADD CONSTRAINT chk_prueba_saber_level 
CHECK (prueba_saber_level IS NULL OR prueba_saber_level IN (3, 5, 7, 9, 11));

-- PASO 5: Agregar campo tipo en questions también
ALTER TABLE questions 
ADD COLUMN prueba_saber_type VARCHAR(20) NULL 
COMMENT 'Tipo de Prueba Saber: "11" (grado 11), "Pro", "TyT"' 
AFTER prueba_saber_level;

-- PASO 6: Actualizar índice para incluir el nuevo campo
ALTER TABLE questionnaires
DROP INDEX IF EXISTS idx_prueba_saber_questionnaire;

ALTER TABLE questionnaires
ADD INDEX idx_prueba_saber_questionnaire (is_prueba_saber, prueba_saber_level, prueba_saber_type);

-- PASO 7: Agregar índice en questions también
ALTER TABLE questions
DROP INDEX IF EXISTS idx_prueba_saber;

ALTER TABLE questions
ADD INDEX idx_prueba_saber (is_prueba_saber, prueba_saber_level, prueba_saber_type);

-- =====================================================
-- VERIFICACIÓN: Ejecuta estas consultas después para verificar
-- =====================================================

-- Verificar estructura de questionnaires:
-- DESCRIBE questionnaires;

-- Verificar estructura de questions:
-- DESCRIBE questions;

-- Verificar constraints:
-- SELECT CONSTRAINT_NAME, CHECK_CLAUSE 
-- FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
-- WHERE TABLE_NAME IN ('questionnaires', 'questions');

-- =====================================================
-- NOTAS DE USO
-- =====================================================
-- 
-- Ejemplos de uso:
-- 
-- 1. Prueba Saber grado 3:
--    prueba_saber_level = 3, prueba_saber_type = NULL
-- 
-- 2. Prueba Saber grado 7:
--    prueba_saber_level = 7, prueba_saber_type = NULL
-- 
-- 3. Prueba Saber grado 11:
--    prueba_saber_level = 11, prueba_saber_type = "11"
-- 
-- 4. Prueba Saber Pro:
--    prueba_saber_level = 11, prueba_saber_type = "Pro"
-- 
-- 5. Prueba Saber TyT:
--    prueba_saber_level = 11, prueba_saber_type = "TyT"
-- 
-- =====================================================
