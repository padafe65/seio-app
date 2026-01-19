-- =====================================================
-- MIGRACIÓN: Sistema de Licencias de Docentes por Institución
-- Fecha: 2025-01-29
-- Descripción: Permite que un docente tenga múltiples licencias (una por institución)
-- Opción 1: Tabla teacher_institutions con contadores en teachers
-- =====================================================

-- PASO 1: Crear tabla teacher_institutions para manejar múltiples instituciones por docente
CREATE TABLE IF NOT EXISTS teacher_institutions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  teacher_id INT NOT NULL COMMENT 'ID del docente (FK a teachers.id)',
  institution VARCHAR(100) NOT NULL COMMENT 'Nombre de la institución educativa',
  license_status ENUM('active', 'expired', 'suspended') DEFAULT 'active' COMMENT 'Estado de la licencia',
  purchased_date DATE COMMENT 'Fecha de compra de la licencia',
  expiration_date DATE COMMENT 'Fecha de expiración de la licencia (NULL = sin expiración)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
  
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_teacher_institution (teacher_id, institution),
  INDEX idx_teacher_id (teacher_id),
  INDEX idx_institution (institution),
  INDEX idx_license_status (license_status),
  INDEX idx_active_licenses (teacher_id, license_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Tabla para gestionar múltiples licencias de docentes por institución';

-- PASO 2: Agregar campos de contadores a la tabla teachers
ALTER TABLE teachers 
ADD COLUMN total_licenses INT DEFAULT 1 COMMENT 'Total de licencias compradas en la historia del docente' AFTER institution,
ADD COLUMN active_licenses INT DEFAULT 1 COMMENT 'Número de licencias actualmente activas' AFTER total_licenses;

-- PASO 3: Migrar datos existentes de teachers.institution a teacher_institutions
-- Para cada docente que tiene una institución, crear un registro en teacher_institutions
-- La fecha de expiración se calcula automáticamente: 1 año después de la fecha de compra
INSERT INTO teacher_institutions (teacher_id, institution, license_status, purchased_date, expiration_date)
SELECT 
  id as teacher_id,
  institution,
  'active' as license_status,
  CURDATE() as purchased_date,
  DATE_ADD(CURDATE(), INTERVAL 1 YEAR) as expiration_date  -- Calcula automáticamente 1 año después
FROM teachers
WHERE institution IS NOT NULL 
  AND institution != ''
  AND NOT EXISTS (
    SELECT 1 FROM teacher_institutions ti 
    WHERE ti.teacher_id = teachers.id 
      AND ti.institution = teachers.institution
  );

-- PASO 4: Actualizar contadores en teachers basándose en teacher_institutions
UPDATE teachers t
SET 
  total_licenses = (
    SELECT COUNT(*) 
    FROM teacher_institutions ti 
    WHERE ti.teacher_id = t.id
  ),
  active_licenses = (
    SELECT COUNT(*) 
    FROM teacher_institutions ti 
    WHERE ti.teacher_id = t.id 
      AND ti.license_status = 'active'
  )
WHERE EXISTS (
  SELECT 1 FROM teacher_institutions ti WHERE ti.teacher_id = t.id
);

-- PASO 5: Establecer valores por defecto para docentes sin registros en teacher_institutions
UPDATE teachers
SET 
  total_licenses = COALESCE(total_licenses, 0),
  active_licenses = COALESCE(active_licenses, 0)
WHERE total_licenses IS NULL OR active_licenses IS NULL;

-- PASO 6: Actualizar valores por defecto de las columnas nuevas
ALTER TABLE teachers 
MODIFY COLUMN total_licenses INT DEFAULT 0 COMMENT 'Total de licencias compradas en la historia del docente',
MODIFY COLUMN active_licenses INT DEFAULT 0 COMMENT 'Número de licencias actualmente activas';

-- =====================================================
-- VERIFICACIÓN: Ejecuta estas consultas después para verificar
-- =====================================================

-- Verificar estructura de teacher_institutions:
-- DESCRIBE teacher_institutions;

-- Verificar campos agregados a teachers:
-- DESCRIBE teachers;

-- Verificar datos migrados:
-- SELECT 
--   t.id,
--   t.user_id,
--   t.subject,
--   t.institution as teacher_institution,
--   t.total_licenses,
--   t.active_licenses,
--   (SELECT COUNT(*) FROM teacher_institutions ti WHERE ti.teacher_id = t.id) as institutions_count
-- FROM teachers t
-- LIMIT 10;

-- Ver todas las licencias de un docente específico:
-- SELECT * FROM teacher_institutions WHERE teacher_id = ?;

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 
-- 1. La tabla teacher_institutions permite que un docente tenga múltiples instituciones
-- 2. El campo teachers.institution se mantiene por compatibilidad (puede ser la institución principal)
-- 3. Los contadores total_licenses y active_licenses se actualizan automáticamente al crear/modificar licencias
-- 4. Para agregar una nueva licencia (con cálculo automático de expiración):
--    INSERT INTO teacher_institutions 
--    (teacher_id, institution, license_status, purchased_date, expiration_date)
--    VALUES (?, ?, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR));
--    
--    UPDATE teachers 
--    SET total_licenses = (
--      SELECT COUNT(*) FROM teacher_institutions WHERE teacher_id = ?
--    ),
--    active_licenses = (
--      SELECT COUNT(*) FROM teacher_institutions 
--      WHERE teacher_id = ? AND license_status = 'active'
--    )
--    WHERE id = ?;
-- 
-- 5. Para suspender una licencia (NO borra datos del docente ni estudiantes):
--    UPDATE teacher_institutions 
--    SET license_status = 'suspended',
--        updated_at = NOW()
--    WHERE teacher_id = ? AND institution = ?;
--    
--    UPDATE teachers 
--    SET active_licenses = (
--      SELECT COUNT(*) FROM teacher_institutions 
--      WHERE teacher_id = ? AND license_status = 'active'
--    )
--    WHERE id = ?;
-- 
-- 6. Para reactivar una licencia (cuando el docente paga):
--    UPDATE teacher_institutions 
--    SET license_status = 'active',
--        expiration_date = DATE_ADD(COALESCE(expiration_date, CURDATE()), INTERVAL 1 YEAR),
--        updated_at = NOW()
--    WHERE teacher_id = ? AND institution = ?;
--    
--    UPDATE teachers 
--    SET active_licenses = (
--      SELECT COUNT(*) FROM teacher_institutions 
--      WHERE teacher_id = ? AND license_status = 'active'
--    )
--    WHERE id = ?;
