-- Identifica el contexto principal del perfil y permite perfiles Preicfes sin grado escolar.
ALTER TABLE students
  MODIFY COLUMN grade VARCHAR(20) NULL,
  ADD COLUMN learning_context ENUM('institutional','preicfes') NOT NULL DEFAULT 'institutional',
  ADD COLUMN preicfes_program VARCHAR(100) NULL;
