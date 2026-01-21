-- =====================================================
-- MIGRACIÓN: Agregar soporte para guías de estudio (PDFs) subidas por profesores
-- Fecha: 2025-01-30
-- Descripción: Permite que profesores suban PDFs como guías de estudio
--              Compatible con almacenamiento local y AWS S3
-- =====================================================

-- PASO 1: Agregar campo file_path para almacenar ruta del PDF subido
ALTER TABLE educational_resources 
ADD COLUMN file_path VARCHAR(500) NULL COMMENT 'Ruta del archivo PDF subido (local o URL de S3)' AFTER url;

-- PASO 2: Agregar campo teacher_id para asociar directamente al profesor
ALTER TABLE educational_resources 
ADD COLUMN teacher_id INT NULL COMMENT 'ID del profesor que creó el recurso (FK a teachers.id)' AFTER created_by;

-- PASO 3: Agregar foreign key para teacher_id
ALTER TABLE educational_resources
ADD CONSTRAINT fk_educational_resources_teacher 
FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

-- PASO 4: Modificar el campo url para que NO sea obligatorio (ahora puede ser NULL)
ALTER TABLE educational_resources 
MODIFY COLUMN url VARCHAR(500) NULL COMMENT 'URL del recurso educativo (opcional si hay file_path)';

-- PASO 5: Agregar índice para búsquedas por profesor y fase
ALTER TABLE educational_resources
ADD INDEX idx_teacher_phase (teacher_id, phase);

-- PASO 6: Agregar índice para búsquedas por profesor, materia y grado
ALTER TABLE educational_resources
ADD INDEX idx_teacher_subject_grade (teacher_id, subject, grade_level);

-- =====================================================
-- VERIFICACIÓN: Ejecuta estas consultas después para verificar
-- =====================================================

-- Verificar estructura de educational_resources:
-- DESCRIBE educational_resources;

-- Verificar que los índices se crearon correctamente:
-- SHOW INDEX FROM educational_resources WHERE Column_name IN ('teacher_id', 'file_path');

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 
-- 1. file_path puede contener:
--    - Ruta local: "guides/guia-1234567890.pdf"
--    - URL de S3: "https://seio-bucket.s3.amazonaws.com/guides/guia-123.pdf"
--
-- 2. url ahora es opcional:
--    - Si hay file_path (PDF subido): url puede ser NULL o un enlace complementario
--    - Si NO hay file_path: url es obligatorio (enlace externo)
--
-- 3. teacher_id permite asociar recursos directamente al profesor:
--    - Facilita filtrar guías por profesor
--    - Útil para que estudiantes vean guías de sus profesores
--
-- 4. Los recursos pueden tener:
--    - Solo file_path: PDF subido
--    - Solo url: Enlace externo
--    - Ambos: PDF subido + enlace complementario