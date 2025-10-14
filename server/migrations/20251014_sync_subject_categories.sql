-- Migración para sincronizar subject_categories con questionnaires existentes
-- Fecha: 2025-10-14

-- Insertar todas las combinaciones únicas de subject-category de questionnaires
-- que no existen en subject_categories

INSERT IGNORE INTO subject_categories (subject, category)
SELECT DISTINCT 
  q.subject,
  q.category
FROM questionnaires q
WHERE q.subject IS NOT NULL 
  AND q.category IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM subject_categories sc 
    WHERE sc.subject = q.subject 
      AND sc.category = q.category
  );

-- Verificar el resultado
SELECT 
  'subject_categories después de la migración' as tabla,
  COUNT(*) as total_registros
FROM subject_categories;

