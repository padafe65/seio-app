# Instrucciones para Ejecutar en phpMyAdmin

## Paso 1: Sincronizar subject_categories con questionnaires

Abre **phpMyAdmin**, selecciona la base de datos `seio_db`, ve a la pestaña **SQL** y ejecuta:

```sql
-- Sincronizar todas las combinaciones de questionnaires a subject_categories
INSERT IGNORE INTO subject_categories (subject, category)
SELECT DISTINCT 
  q.subject,
  q.category
FROM questionnaires q
WHERE q.subject IS NOT NULL 
  AND q.category IS NOT NULL;

-- Ver cuántas se agregaron
SELECT 'Total combinaciones después de sincronización' as info, COUNT(*) as total 
FROM subject_categories;
```

## Paso 2: Corregir el typo de "cinemática"

```sql
-- Corregir el typo en questionnaires
UPDATE questionnaires 
SET category = 'Cinemática'
WHERE category IN ('cimemática', 'cinemática', 'Cinematica', 'cinematica');

-- Corregir el typo en subject_categories
UPDATE subject_categories
SET category = 'Cinemática'
WHERE category IN ('cimemática', 'cinemática', 'Cinematica', 'cinematica');

-- Eliminar duplicados si los hay
DELETE sc1 FROM subject_categories sc1
INNER JOIN subject_categories sc2 
WHERE sc1.id > sc2.id 
  AND sc1.subject = sc2.subject 
  AND sc1.category = sc2.category;

-- Verificar
SELECT subject, category 
FROM subject_categories 
WHERE subject LIKE '%Física%'
ORDER BY subject, category;
```

## Paso 3: Verificar el Cuestionario "Física 1_1"

```sql
-- Ver el cuestionario específico
SELECT id, title, subject, category, grade, phase, course_id
FROM questionnaires 
WHERE id = 8 OR title LIKE '%Fisica%';

-- Ver todas las categorías para "Física 1"
SELECT * 
FROM subject_categories 
WHERE subject = 'Física 1';
```

## Resultado Esperado

Después de ejecutar estos scripts, deberías ver:

1. ✅ El cuestionario con `id=8` debe tener:
   - `subject` = "Física 1"
   - `category` = "Cinemática" (con mayúscula inicial, sin typo)

2. ✅ En `subject_categories` debe existir:
   - Un registro con `subject` = "Física 1" y `category` = "Cinemática"

3. ✅ Al editar el cuestionario en el frontend, el dropdown de categorías debe mostrar "Cinemática"

## Notas

- El backend ahora sincroniza automáticamente al iniciar el servidor
- Cada vez que edites/crees un cuestionario, se actualizará `subject_categories`
- Si hay algún problema, puedes volver a ejecutar el Paso 1 sin riesgo (usa `INSERT IGNORE`)

