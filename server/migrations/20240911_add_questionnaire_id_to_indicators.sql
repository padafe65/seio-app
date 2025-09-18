-- Añadir la columna questionnaire_id a la tabla indicators
ALTER TABLE indicators
ADD COLUMN questionnaire_id INT NULL,
ADD CONSTRAINT fk_indicators_questionnaire
  FOREIGN KEY (questionnaire_id) 
  REFERENCES questionnaires(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Añadir un índice para mejorar el rendimiento de las consultas
CREATE INDEX idx_indicators_questionnaire_id ON indicators(questionnaire_id);
