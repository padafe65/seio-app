-- ==========================================
-- SISTEMA DE MENSAJERÍA ENTRE ROLES
-- ==========================================
-- Fecha: 2025-01-20
-- Descripción: Tabla para comunicación entre usuarios del sistema
--              (estudiantes, docentes, administradores, super_administradores)
-- ==========================================

-- Crear tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read_status BOOLEAN DEFAULT FALSE,
  message_type ENUM('general', 'academico', 'notificacion', 'solicitud') DEFAULT 'general',
  related_entity_type VARCHAR(50) NULL COMMENT 'Tipo de entidad relacionada (questionnaire, evaluation, etc.)',
  related_entity_id INT NULL COMMENT 'ID de la entidad relacionada',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL COMMENT 'Soft delete para el remitente',
  deleted_at_receiver TIMESTAMP NULL COMMENT 'Soft delete para el receptor',
  
  -- Índices para mejorar rendimiento
  INDEX idx_sender (sender_id),
  INDEX idx_receiver (receiver_id),
  INDEX idx_read_status (read_status),
  INDEX idx_created_at (created_at),
  INDEX idx_message_type (message_type),
  
  -- Foreign keys
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Validación: el remitente y receptor no pueden ser el mismo
  CONSTRAINT chk_different_users CHECK (sender_id != receiver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla para adjuntos (opcional, para futuras mejoras)
CREATE TABLE IF NOT EXISTS message_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT COMMENT 'Tamaño en bytes',
  file_type VARCHAR(100) COMMENT 'Tipo MIME',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  INDEX idx_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla para mensajes grupales (opcional, para futuras mejoras)
CREATE TABLE IF NOT EXISTS group_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  group_type ENUM('course', 'grade', 'institution', 'all_students', 'all_teachers') NOT NULL,
  group_identifier VARCHAR(100) NULL COMMENT 'ID del curso, grado, institución, etc.',
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sender (sender_id),
  INDEX idx_group_type (group_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla para destinatarios de mensajes grupales
CREATE TABLE IF NOT EXISTS group_message_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_message_id INT NOT NULL,
  receiver_id INT NOT NULL,
  read_status BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  
  FOREIGN KEY (group_message_id) REFERENCES group_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_group_recipient (group_message_id, receiver_id),
  INDEX idx_receiver (receiver_id),
  INDEX idx_read_status (read_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- COMENTARIOS SOBRE LA ESTRUCTURA
-- ==========================================
-- 
-- 1. Tabla messages:
--    - Almacena mensajes individuales entre dos usuarios
--    - read_status: indica si el receptor ha leído el mensaje
--    - message_type: categoriza el tipo de mensaje
--    - related_entity: permite vincular mensajes a cuestionarios, evaluaciones, etc.
--    - Soft delete: deleted_at y deleted_at_receiver permiten que cada usuario
--      elimine el mensaje de su vista sin afectar al otro
--
-- 2. Tabla message_attachments:
--    - Para futuras mejoras: adjuntar archivos a mensajes
--
-- 3. Tabla group_messages:
--    - Para futuras mejoras: enviar mensajes a grupos (curso, grado, etc.)
--
-- 4. Tabla group_message_recipients:
--    - Rastrea qué usuarios de un grupo han leído el mensaje
--
-- ==========================================
