-- Migración para agregar campos institution y teacher_id a la tabla courses
-- Fecha: 2025-01-10
-- Descripción: Permite asociar cursos con institución y docente para gestión por super_administrador

-- Verificar y agregar el campo institution
ALTER TABLE `courses` 
ADD COLUMN `institution` VARCHAR(100) DEFAULT NULL COMMENT 'Institución a la que pertenece el curso' AFTER `grade`;

-- Verificar y agregar el campo teacher_id (para asociar curso principal con un docente)
ALTER TABLE `courses` 
ADD COLUMN `teacher_id` INT(11) DEFAULT NULL COMMENT 'ID del docente principal del curso (opcional)' AFTER `institution`;

-- Agregar índice para mejorar búsquedas por institución
CREATE INDEX `idx_courses_institution` ON `courses` (`institution`);

-- Agregar índice para mejorar búsquedas por docente
CREATE INDEX `idx_courses_teacher_id` ON `courses` (`teacher_id`);

-- Agregar foreign key constraint para teacher_id (opcional, si quieres integridad referencial)
-- ALTER TABLE `courses`
-- ADD CONSTRAINT `fk_courses_teacher_id` 
-- FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) 
-- ON DELETE SET NULL ON UPDATE CASCADE;

-- Verificar la estructura final de la tabla
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses'
-- ORDER BY ORDINAL_POSITION;
