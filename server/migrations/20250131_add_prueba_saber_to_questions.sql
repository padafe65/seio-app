    -- =====================================================
    -- MIGRACIÓN: Agregar soporte para Prueba Saber en preguntas
    -- Fecha: 2025-01-31
    -- Descripción: Permite marcar preguntas como tipo Prueba Saber 
    --              y definir el nivel (3°, 5°, 9° o 11°)
    -- =====================================================

    -- PASO 1: Agregar campo para indicar si es pregunta tipo Prueba Saber
    ALTER TABLE questions 
    ADD COLUMN is_prueba_saber BOOLEAN DEFAULT FALSE 
    COMMENT 'Indica si la pregunta es tipo Prueba Saber' 
    AFTER category;

    -- PASO 2: Agregar campo para el nivel de Prueba Saber (3, 5, 9 o 11)
    ALTER TABLE questions 
    ADD COLUMN prueba_saber_level INT NULL 
    COMMENT 'Nivel de Prueba Saber: 3, 5, 9 o 11' 
    AFTER is_prueba_saber;

    -- PASO 3: Agregar índice para búsquedas eficientes de Prueba Saber
    ALTER TABLE questions
    ADD INDEX idx_prueba_saber (is_prueba_saber, prueba_saber_level);

    -- PASO 4: Agregar constraint para validar que solo acepte valores válidos (3, 5, 9, 11)
    ALTER TABLE questions
    ADD CONSTRAINT chk_prueba_saber_level 
    CHECK (prueba_saber_level IS NULL OR prueba_saber_level IN (3, 5, 9, 11));

    -- =====================================================
    -- VERIFICACIÓN: Ejecuta estas consultas después para verificar
    -- =====================================================

    -- Verificar estructura de questions:
    -- DESCRIBE questions;

    -- Verificar que los índices se crearon correctamente:
    -- SHOW INDEX FROM questions WHERE Column_name IN ('is_prueba_saber', 'prueba_saber_level');

    -- =====================================================
