-- Función para evaluar automáticamente indicadores basándose en notas
DELIMITER ;;
CREATE FUNCTION `evaluateIndicatorsByScore`(
  p_student_id INT,
  p_questionnaire_id INT,
  p_best_score DECIMAL(5,2)
) RETURNS TEXT
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_indicator_id INT;
  DECLARE v_passing_score DECIMAL(5,2);
  DECLARE v_achieved TINYINT;
  DECLARE v_result TEXT DEFAULT '';
  
  DECLARE indicator_cursor CURSOR FOR
    SELECT qi.indicator_id, qi.passing_score
    FROM questionnaire_indicators qi
    WHERE qi.questionnaire_id = p_questionnaire_id;
    
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  OPEN indicator_cursor;
  
  read_loop: LOOP
    FETCH indicator_cursor INTO v_indicator_id, v_passing_score;
    IF done THEN
      LEAVE read_loop;
    END IF;
    
    -- Determinar si el indicador fue aprobado
    SET v_achieved = CASE 
      WHEN p_best_score >= v_passing_score THEN 1 
      ELSE 0 
    END;
    
    -- Actualizar o insertar en student_indicators
    INSERT INTO student_indicators (student_id, indicator_id, achieved, questionnaire_id, updated_at)
    VALUES (p_student_id, v_indicator_id, v_achieved, p_questionnaire_id, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      achieved = v_achieved,
      questionnaire_id = p_questionnaire_id,
      updated_at = CURRENT_TIMESTAMP;
    
    -- Construir resultado
    SET v_result = CONCAT(v_result, 
      IF(v_result = '', '', ', '),
      CONCAT('Indicador ', v_indicator_id, ': ', 
        IF(v_achieved = 1, 'APROBADO', 'REPROBADO'), 
        ' (', p_best_score, '/', v_passing_score, ')')
    );
    
  END LOOP;
  
  CLOSE indicator_cursor;
  
  RETURN v_result;
END;;
DELIMITER ;
