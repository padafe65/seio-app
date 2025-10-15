-- Modificar el trigger existente para incluir evaluación de indicadores
DELIMITER ;;
DROP TRIGGER IF EXISTS `tr_update_student_indicators_after_evaluation`;;

CREATE TRIGGER `tr_update_student_indicators_after_evaluation`
AFTER UPDATE ON `evaluation_results`
FOR EACH ROW
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_indicator_id INT;
  DECLARE v_passing_score DECIMAL(5,2);
  DECLARE v_achieved TINYINT;
  
  DECLARE indicator_cursor CURSOR FOR
    SELECT qi.indicator_id, qi.passing_score
    FROM questionnaire_indicators qi
    WHERE qi.questionnaire_id = NEW.questionnaire_id;
    
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  -- Solo procesar si la nota cambió
  IF OLD.best_score != NEW.best_score THEN
    OPEN indicator_cursor;
    
    read_loop: LOOP
      FETCH indicator_cursor INTO v_indicator_id, v_passing_score;
      IF done THEN
        LEAVE read_loop;
      END IF;
      
      -- Determinar si el indicador fue aprobado
      SET v_achieved = CASE 
        WHEN NEW.best_score >= v_passing_score THEN 1 
        ELSE 0 
      END;
      
      -- Actualizar o insertar en student_indicators
      INSERT INTO student_indicators (student_id, indicator_id, achieved, questionnaire_id, updated_at)
      VALUES (NEW.student_id, v_indicator_id, v_achieved, NEW.questionnaire_id, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        achieved = v_achieved,
        questionnaire_id = NEW.questionnaire_id,
        updated_at = CURRENT_TIMESTAMP;
      
    END LOOP;
    
    CLOSE indicator_cursor;
  END IF;
END;;
DELIMITER ;
