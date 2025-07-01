-- Script para actualizar el sistema de roles y permisos en SEIO
-- Este script debe ejecutarse después de hacer un respaldo de la base de datos

-- 1. Agregar columna 'estado' a la tabla users si no existe
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS estado ENUM('pendiente', 'activo', 'suspendido') NOT NULL DEFAULT 'pendiente';

-- 2. Crear tabla de roles si no existe
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Crear tabla de relación usuarios-roles si no existe
CREATE TABLE IF NOT EXISTS user_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    granted_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_role (user_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Insertar roles básicos si no existen
INSERT IGNORE INTO roles (name, description) VALUES 
('super_administrador', 'Super administrador con acceso total al sistema'),
('administrador', 'Administrador del sistema con amplios privilegios'),
('docente', 'Profesor que puede gestionar cursos y evaluaciones'),
('estudiante', 'Estudiante que puede realizar evaluaciones');

-- 5. Actualizar usuarios existentes
-- Establecer estado 'activo' para usuarios existentes
UPDATE users SET estado = 'activo' WHERE estado IS NULL OR estado = '';

-- 6. Migrar roles existentes a la nueva estructura
-- Primero, asegurarse de que el rol 'estudiante' exista
SET @estudiante_id = (SELECT id FROM roles WHERE name = 'estudiante' LIMIT 1);
SET @admin_id = (SELECT id FROM roles WHERE name = 'administrador' LIMIT 1);

-- Asignar rol 'estudiante' a todos los usuarios que no tengan roles asignados
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, @estudiante_id
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.id IS NULL;

-- Asignar rol 'administrador' a los usuarios que ya tenían ese rol
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, @admin_id
FROM users u
WHERE u.role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id AND ur.role_id = @admin_id
);

-- 7. Crear índices para mejorar el rendimiento
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- 8. Crear vista para facilitar consultas de usuarios con sus roles
CREATE OR REPLACE VIEW vw_user_roles AS
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    u.email,
    u.estado,
    GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ', ') AS roles,
    COUNT(r.id) AS role_count,
    u.created_at AS user_created_at,
    MAX(ur.created_at) AS last_role_assigned
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
GROUP BY u.id, u.name, u.email, u.estado, u.created_at;

-- 9. Crear procedimiento almacenado para asignar roles
DELIMITER //
CREATE PROCEDURE sp_assign_user_role(
    IN p_user_id INT,
    IN p_role_name VARCHAR(50),
    IN p_granted_by INT
)
BEGIN
    DECLARE v_role_id INT;
    
    -- Obtener ID del rol
    SELECT id INTO v_role_id FROM roles WHERE name = p_role_name LIMIT 1;
    
    -- Si el rol no existe, lanzar error
    IF v_role_id IS NULL THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Rol no encontrado';
    END IF;
    
    -- Asignar rol al usuario
    INSERT INTO user_roles (user_id, role_id, granted_by)
    VALUES (p_user_id, v_role_id, p_granted_by)
    ON DUPLICATE KEY UPDATE 
        granted_by = VALUES(granted_by),
        updated_at = CURRENT_TIMESTAMP;
        
    -- Devolver éxito
    SELECT 'Rol asignado correctamente' AS message;
END //
DELIMITER ;

-- 10. Crear procedimiento para verificar permisos
DELIMITER //
CREATE FUNCTION fn_has_role(p_user_id INT, p_role_name VARCHAR(50)) 
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_has_role BOOLEAN;
    
    SELECT COUNT(*) > 0 INTO v_has_role
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
    AND r.name = p_role_name;
    
    RETURN v_has_role;
END //
DELIMITER ;

-- 11. Crear vista para auditoría de cambios de roles
CREATE OR REPLACE VIEW vw_role_audit AS
SELECT 
    ur.id AS assignment_id,
    u1.name AS user_name,
    u1.email AS user_email,
    r.name AS role_name,
    u2.name AS granted_by_name,
    u2.email AS granted_by_email,
    ur.created_at,
    ur.updated_at
FROM user_roles ur
JOIN users u1 ON ur.user_id = u1.id
JOIN roles r ON ur.role_id = r.id
LEFT JOIN users u2 ON ur.granted_by = u2.id
ORDER BY ur.updated_at DESC;

-- 12. Crear trigger para auditoría de cambios de estado
DELIMITER //
CREATE TRIGGER trg_users_status_change
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF OLD.estado <> NEW.estado THEN
        INSERT INTO user_status_history (user_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.estado, NEW.estado, @current_user_id);
    END IF;
END //
DELIMITER ;

-- 13. Crear tabla para historial de cambios de estado
CREATE TABLE IF NOT EXISTS user_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_status_history_user_id (user_id),
    INDEX idx_user_status_history_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mensaje de finalización
SELECT 'Script de actualización del sistema de roles completado con éxito' AS message;
