-- =====================================================
-- MIGRACIÓN: Agregar campo institution a users y students
-- Fecha: 2025-01-06
-- Descripción: Permite gestionar múltiples instituciones educativas
-- =====================================================

-- PASO 1: Agregar campo institution a la tabla users
-- Este campo será la fuente principal de verdad para la institución del usuario
ALTER TABLE users 
ADD COLUMN institution VARCHAR(100) NULL AFTER phone;

-- PASO 2: Migrar datos existentes de institution desde teachers a users
-- Si un docente ya tiene institution en la tabla teachers, copiarlo a users
UPDATE users u
INNER JOIN teachers t ON u.id = t.user_id
SET u.institution = t.institution
WHERE t.institution IS NOT NULL 
  AND t.institution != ''
  AND (u.institution IS NULL OR u.institution = '');

-- PASO 3: Agregar campo institution a students (para facilitar consultas y sincronización)
ALTER TABLE students 
ADD COLUMN institution VARCHAR(100) NULL AFTER course_id;

-- PASO 4: Sincronizar institution desde users a students
-- Todos los estudiantes deben tener la misma institución que su usuario
UPDATE students s
INNER JOIN users u ON s.user_id = u.id
SET s.institution = u.institution
WHERE u.institution IS NOT NULL 
  AND u.institution != '';

-- PASO 5: Crear índices para mejorar búsquedas por institución
CREATE INDEX idx_users_institution ON users(institution);
CREATE INDEX idx_students_institution ON students(institution);

-- =====================================================
-- VERIFICACIÓN: Ejecuta estas consultas después para verificar
-- =====================================================
-- Verificar que el campo existe en users:
-- DESCRIBE users;

-- Verificar que el campo existe en students:
-- DESCRIBE students;

-- Verificar datos migrados:
-- SELECT u.id, u.name, u.role, u.institution, t.institution as teacher_institution
-- FROM users u
-- LEFT JOIN teachers t ON u.id = t.user_id
-- WHERE u.role = 'docente';

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 1. El campo institution en users es la FUENTE PRINCIPAL
-- 2. El campo institution en students se sincroniza automáticamente desde users
-- 3. El campo institution en teachers se mantiene por compatibilidad
-- 4. Todos los usuarios (estudiantes, docentes, admins) pueden tener institución
-- 5. El campo es NULL por defecto (opcional)
