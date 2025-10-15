-- Crear tabla de relación entre cuestionarios e indicadores
CREATE TABLE `questionnaire_indicators` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `questionnaire_id` int(11) NOT NULL,
  `indicator_id` int(11) NOT NULL,
  `weight` decimal(3,2) DEFAULT 1.00 COMMENT 'Peso del indicador en el cuestionario (0.00-1.00)',
  `passing_score` decimal(5,2) DEFAULT 3.50 COMMENT 'Nota mínima para aprobar este indicador',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_questionnaire_indicator` (`questionnaire_id`, `indicator_id`),
  KEY `idx_questionnaire` (`questionnaire_id`),
  KEY `idx_indicator` (`indicator_id`),
  CONSTRAINT `fk_questionnaire_indicators_questionnaire` 
    FOREIGN KEY (`questionnaire_id`) REFERENCES `questionnaires` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_questionnaire_indicators_indicator` 
    FOREIGN KEY (`indicator_id`) REFERENCES `indicators` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Migrar datos existentes (indicators que ya tienen questionnaire_id)
INSERT INTO `questionnaire_indicators` (`questionnaire_id`, `indicator_id`, `passing_score`)
SELECT 
  questionnaire_id, 
  id as indicator_id, 
  3.50 as passing_score
FROM `indicators` 
WHERE questionnaire_id IS NOT NULL;

-- Agregar índices para mejorar rendimiento
ALTER TABLE `student_indicators` 
ADD INDEX `idx_student_questionnaire` (`student_id`, `questionnaire_id`);

-- Crear trigger para actualizar automáticamente student_indicators cuando se actualiza evaluation_results
DELIMITER ;;
CREATE TRIGGER `tr_update_student_indicators_after_evaluation`
AFTER UPDATE ON `evaluation_results`
FOR EACH ROW
BEGIN
  -- Actualizar indicadores del estudiante basándose en la mejor nota
  UPDATE `student_indicators` si
  JOIN `questionnaire_indicators` qi ON si.indicator_id = qi.indicator_id
  SET 
    si.achieved = CASE 
      WHEN NEW.best_score >= qi.passing_score THEN 1 
      ELSE 0 
    END,
    si.questionnaire_id = NEW.questionnaire_id,
    si.updated_at = CURRENT_TIMESTAMP
  WHERE 
    si.student_id = NEW.student_id 
    AND qi.questionnaire_id = NEW.questionnaire_id;
END;;
DELIMITER ;
