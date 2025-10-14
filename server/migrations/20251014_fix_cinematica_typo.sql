-- Corrección de typo: "cimemática" → "cinemática"
-- Fecha: 2025-10-14

-- 1. Actualizar questionnaires
UPDATE questionnaires 
SET category = 'Cinemática'
WHERE category = 'cimemática' OR category = 'cinemática';

-- 2. Actualizar subject_categories si existe el typo
UPDATE subject_categories
SET category = 'Cinemática'
WHERE category = 'cimemática' OR category = 'cinemática';

-- 3. Verificar el resultado
SELECT 
  'Cuestionarios con Cinemática' as tabla,
  COUNT(*) as total
FROM questionnaires
WHERE category = 'Cinemática';

SELECT 
  'subject_categories con Cinemática' as tabla,
  COUNT(*) as total
FROM subject_categories
WHERE category = 'Cinemática';

