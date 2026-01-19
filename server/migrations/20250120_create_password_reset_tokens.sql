-- =====================================================
-- MIGRACIÓN: Sistema Seguro de Recuperación de Contraseña
-- Fecha: 2025-01-20
-- Descripción: Tabla para almacenar tokens temporales de recuperación de contraseña
-- =====================================================

-- Crear tabla para tokens de recuperación de contraseña
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_used (used),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Limpiar tokens expirados (se puede ejecutar periódicamente)
-- DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE;
