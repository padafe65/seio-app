-- SQL Migration: Agregar columna profile_image a tabla users
-- Ejecuta este script en tu base de datos MySQL

-- Agregar columna profile_image si no existe
ALTER TABLE `users` 
ADD COLUMN `profile_image` varchar(512) DEFAULT NULL COMMENT 'Ruta o URL de la imagen de perfil del usuario' 
AFTER `updated_at`;

-- Verificar que la columna se creó correctamente
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users' AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION;
