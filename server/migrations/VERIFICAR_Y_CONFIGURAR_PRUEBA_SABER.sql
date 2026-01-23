-- =====================================================
-- SCRIPT: Verificar y Configurar Prueba Saber
-- Descripción: Verifica el estado de los cuestionarios y configura
--              los que deberían ser Prueba Saber
-- =====================================================

-- PASO 1: Verificar estado actual de cuestionarios
SELECT '=== CUESTIONARIOS ACTUALES (GRADO 7 y 11) ===' as info;
SELECT 
  id, 
  title, 
  grade, 
  is_prueba_saber, 
  prueba_saber_level,
  prueba_saber_type,
  (SELECT COUNT(*) FROM questions WHERE questionnaire_id = questionnaires.id) as num_preguntas
FROM questionnaires 
WHERE grade IN (7, 11)
ORDER BY grade, id;

-- PASO 2: Verificar si existen las columnas necesarias
SELECT '=== VERIFICANDO COLUMNAS ===' as info;
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'questionnaires' 
  AND COLUMN_NAME IN ('is_prueba_saber', 'prueba_saber_level', 'prueba_saber_type')
ORDER BY ORDINAL_POSITION;

-- PASO 3: Si no existen las columnas, agregarlas
-- (Ejecutar solo si el PASO 2 no mostró las columnas)
/*
ALTER TABLE questionnaires 
ADD COLUMN IF NOT EXISTS is_prueba_saber BOOLEAN DEFAULT FALSE 
AFTER description;

ALTER TABLE questionnaires 
ADD COLUMN IF NOT EXISTS prueba_saber_level INT NULL 
AFTER is_prueba_saber;

ALTER TABLE questionnaires 
ADD COLUMN IF NOT EXISTS prueba_saber_type VARCHAR(20) NULL 
AFTER prueba_saber_level;
*/

-- PASO 4: Configurar cuestionarios existentes como Prueba Saber
-- IMPORTANTE: Ajusta estos UPDATE según tus cuestionarios reales

-- Ejemplo: Si tienes un cuestionario de grado 7 que debería ser Prueba Saber
-- UPDATE questionnaires 
-- SET is_prueba_saber = TRUE, prueba_saber_level = 7 
-- WHERE id = ? AND grade = 7;

-- Ejemplo: Si tienes cuestionarios de grado 11 que deberían ser Prueba Saber
-- UPDATE questionnaires 
-- SET is_prueba_saber = TRUE, prueba_saber_level = 11, prueba_saber_type = '11'
-- WHERE id = ? AND grade = 11;

-- PASO 5: Verificar el resultado
SELECT '=== CUESTIONARIOS DESPUÉS DE CONFIGURAR ===' as info;
SELECT 
  id, 
  title, 
  grade, 
  is_prueba_saber, 
  prueba_saber_level,
  prueba_saber_type,
  (SELECT COUNT(*) FROM questions WHERE questionnaire_id = questionnaires.id) as num_preguntas
FROM questionnaires 
WHERE is_prueba_saber = TRUE
ORDER BY prueba_saber_level, id;

-- =====================================================
-- INSTRUCCIONES DE USO
-- =====================================================
--
-- 1. Ejecuta el PASO 1 y PASO 2 para ver el estado actual
-- 2. Si no existen las columnas, ejecuta el PASO 3
-- 3. Identifica los IDs de los cuestionarios que deberían ser Prueba Saber
-- 4. Modifica y ejecuta los UPDATE del PASO 4 con los IDs correctos
-- 5. Ejecuta el PASO 5 para verificar
--
-- Ejemplo completo:
-- Si el cuestionario ID 11 de grado 11 debería ser Prueba Saber:
--   UPDATE questionnaires 
--   SET is_prueba_saber = TRUE, prueba_saber_level = 11, prueba_saber_type = '11'
--   WHERE id = 11;
--
-- =====================================================
