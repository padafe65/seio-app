-- Migración para agregar campo institution a la tabla users
-- y sincronizar datos desde teachers a users

-- Paso 1: Agregar campo institution a users
ALTER TABLE users 
ADD COLUMN institution VARCHAR(100) NULL AFTER phone;

-- Paso 2: Migrar datos de institution desde teachers a users
-- Para todos los docentes que tengan institution en la tabla teachers
UPDATE users u
INNER JOIN teachers t ON u.id = t.user_id
SET u.institution = t.institution
WHERE t.institution IS NOT NULL AND t.institution != '';

-- Paso 3: Agregar campo institution a students (para facilitar consultas)
ALTER TABLE students 
ADD COLUMN institution VARCHAR(100) NULL AFTER course_id;

-- Paso 4: Sincronizar institution desde users a students
UPDATE students s
INNER JOIN users u ON s.user_id = u.id
SET s.institution = u.institution
WHERE u.institution IS NOT NULL AND u.institution != '';

-- Paso 5: Crear índice para mejorar búsquedas por institución
CREATE INDEX idx_users_institution ON users(institution);
CREATE INDEX idx_students_institution ON students(institution);
CREATE INDEX idx_teachers_institution ON teachers(institution);
