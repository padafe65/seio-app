-- Migración: Agregar campo 'subject' a la tabla questionnaires
-- Fecha: 2025-10-14
-- Descripción: Separar la materia de la categoría para mejor organización

-- Agregar columna subject a questionnaires
ALTER TABLE questionnaires
  ADD COLUMN subject VARCHAR(100) NULL
  AFTER category;

-- Opcional: Si quieres actualizar los registros existentes para extraer el subject de la category
-- Ejemplo: "Matematicas_Geometria" -> subject = "Matematicas", category = "Geometria"
UPDATE questionnaires
SET subject = SUBSTRING_INDEX(category, '_', 1)
WHERE category IS NOT NULL AND category LIKE '%_%';

-- Opcional: Actualizar solo la categoría para que no incluya la materia
UPDATE questionnaires
SET category = SUBSTRING_INDEX(category, '_', -1)
WHERE category IS NOT NULL AND category LIKE '%_%';

-- Verificar los cambios
SELECT id, title, subject, category, grade, phase FROM questionnaires LIMIT 10;

