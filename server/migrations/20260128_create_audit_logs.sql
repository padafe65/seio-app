-- Migración: Sistema de Auditoría Completo
-- Fecha: 2026-01-28
-- Descripción: Crea tabla audit_logs para rastrear todos los cambios en el sistema

-- Crear tabla de logs de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(50) NOT NULL COMMENT 'Acción realizada: CREATE, UPDATE, DELETE, LOGIN, etc.',
  table_name VARCHAR(50) NOT NULL COMMENT 'Tabla afectada',
  record_id INT COMMENT 'ID del registro afectado',
  user_id INT NOT NULL COMMENT 'ID del usuario que realizó la acción',
  user_role VARCHAR(50) COMMENT 'Rol del usuario: super_administrador, administrador, docente',
  user_name VARCHAR(255) COMMENT 'Nombre del usuario para referencia rápida',
  description TEXT COMMENT 'Descripción legible de la acción',
  old_values JSON COMMENT 'Valores anteriores del registro (antes del cambio)',
  new_values JSON COMMENT 'Valores nuevos del registro (después del cambio)',
  ip_address VARCHAR(45) COMMENT 'Dirección IP del usuario',
  user_agent TEXT COMMENT 'Navegador/dispositivo del usuario',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at),
  INDEX idx_user_role (user_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Registro de auditoría de todas las acciones del sistema';

-- Agregar campos de auditoría a la tabla users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS created_by INT COMMENT 'ID del usuario que creó este registro',
  ADD COLUMN IF NOT EXISTS updated_by INT COMMENT 'ID del usuario que actualizó este registro',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL COMMENT 'Fecha de última actualización';

-- Agregar campos de auditoría a la tabla students
ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS created_by INT COMMENT 'ID del usuario que creó este registro',
  ADD COLUMN IF NOT EXISTS updated_by INT COMMENT 'ID del usuario que actualizó este registro',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL COMMENT 'Fecha de última actualización';

-- Agregar campos de auditoría a la tabla teachers
ALTER TABLE teachers 
  ADD COLUMN IF NOT EXISTS created_by INT COMMENT 'ID del usuario que creó este registro',
  ADD COLUMN IF NOT EXISTS updated_by INT COMMENT 'ID del usuario que actualizó este registro',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL COMMENT 'Fecha de última actualización';

-- Agregar campos de auditoría a la tabla courses
ALTER TABLE courses 
  ADD COLUMN IF NOT EXISTS created_by INT COMMENT 'ID del usuario que creó este registro',
  ADD COLUMN IF NOT EXISTS updated_by INT COMMENT 'ID del usuario que actualizó este registro',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL COMMENT 'Fecha de última actualización';

-- Agregar campos de auditoría a la tabla questionnaires
ALTER TABLE questionnaires 
  ADD COLUMN IF NOT EXISTS updated_by INT COMMENT 'ID del usuario que actualizó este registro',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL COMMENT 'Fecha de última actualización';
-- NOTA: questionnaires ya tiene created_by

-- Crear vista para consultas rápidas de auditoría con información del usuario
CREATE OR REPLACE VIEW audit_logs_with_user AS
SELECT 
  al.id,
  al.action,
  al.table_name,
  al.record_id,
  al.user_id,
  al.user_role,
  al.user_name,
  al.description,
  al.old_values,
  al.new_values,
  al.ip_address,
  al.created_at,
  u.name as current_user_name,
  u.email as user_email
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC;

-- Insertar log de creación del sistema de auditoría
INSERT INTO audit_logs (
  action, 
  table_name, 
  record_id, 
  user_id, 
  user_role, 
  user_name,
  description
) VALUES (
  'SYSTEM',
  'audit_logs',
  NULL,
  1,
  'super_administrador',
  'Sistema',
  'Sistema de auditoría implementado - Se creó la tabla audit_logs y campos de auditoría en tablas principales'
);
