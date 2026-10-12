import pool from '../config/db.js';

/**
 * Evalúa si un estudiante aprueba los indicadores de un cuestionario
 * basándose en su mejor puntaje en evaluation_results
 */
export const evaluateStudentIndicators = async (studentId, questionnaireId, academicYear = new Date().getFullYear()) => {
  try {
    console.log(`🔍 Evaluando indicadores para estudiante ${studentId} en cuestionario ${questionnaireId}`);
    
    // 1. Obtener el mejor puntaje del estudiante para este cuestionario
    const [evaluationData] = await pool.query(`
      SELECT MAX(best_score) AS best_score
      FROM evaluation_results
      WHERE student_id = ? AND questionnaire_id = ?
        AND (academic_year = ? OR (academic_year IS NULL AND YEAR(recorded_at) = ?))
    `, [studentId, questionnaireId, academicYear, academicYear]);
    
    if (evaluationData.length === 0 || evaluationData[0].best_score == null) {
      console.log(`⚠️ No se encontró evaluación para estudiante ${studentId} en cuestionario ${questionnaireId}`);
      return { success: false, message: 'No se encontró evaluación para este estudiante y cuestionario' };
    }
    
    const bestScore = parseFloat(evaluationData[0].best_score);
    console.log(`📊 Mejor puntaje encontrado: ${bestScore}`);
    
    // 2. Obtener todos los indicadores asociados al cuestionario con sus notas mínimas
    const [questionnaireIndicators] = await pool.query(`
      SELECT 
        qi.indicator_id,
        qi.passing_score,
        i.description,
        i.subject
      FROM questionnaire_indicators qi
      JOIN indicators i ON qi.indicator_id = i.id
      WHERE qi.questionnaire_id = ?
    `, [questionnaireId]);
    
    if (questionnaireIndicators.length === 0) {
      console.log(`⚠️ No hay indicadores asociados al cuestionario ${questionnaireId}`);
      return { success: false, message: 'No hay indicadores asociados a este cuestionario' };
    }
    
    console.log(`📋 Encontrados ${questionnaireIndicators.length} indicadores para evaluar`);
    
    // 3. Evaluar cada indicador
    const evaluationResults = [];
    
    for (const indicator of questionnaireIndicators) {
      const passingScore = parseFloat(indicator.passing_score);
      const achieved = bestScore >= passingScore;
      
      console.log(`🎯 Indicador ${indicator.indicator_id}: ${indicator.description}`);
      console.log(`   Puntaje del estudiante: ${bestScore}`);
      console.log(`   Nota mínima requerida: ${passingScore}`);
      console.log(`   Resultado: ${achieved ? '✅ APROBADO' : '❌ REPROBADO'}`);
      
      // 4. Actualizar o insertar el resultado en student_indicators
      await pool.query(`
        INSERT INTO student_indicators (student_id, indicator_id, achieved, questionnaire_id, assigned_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          achieved = VALUES(achieved),
          questionnaire_id = VALUES(questionnaire_id),
          assigned_at = VALUES(assigned_at)
      `, [studentId, indicator.indicator_id, achieved, questionnaireId]);
      
      evaluationResults.push({
        indicator_id: indicator.indicator_id,
        description: indicator.description,
        subject: indicator.subject,
        student_score: bestScore,
        passing_score: passingScore,
        achieved: achieved
      });
    }
    
    // 5. Calcular estadísticas
    const totalIndicators = evaluationResults.length;
    const approvedIndicators = evaluationResults.filter(r => r.achieved).length;
    const approvalRate = totalIndicators > 0 ? (approvedIndicators / totalIndicators) * 100 : 0;
    
    console.log(`📊 Resumen de evaluación:`);
    console.log(`   Total indicadores: ${totalIndicators}`);
    console.log(`   Aprobados: ${approvedIndicators}`);
    console.log(`   Reprobados: ${totalIndicators - approvedIndicators}`);
    console.log(`   Tasa de aprobación: ${approvalRate.toFixed(2)}%`);
    
    return {
      success: true,
      student_id: studentId,
      questionnaire_id: questionnaireId,
      best_score: bestScore,
      total_indicators: totalIndicators,
      approved_indicators: approvedIndicators,
      failed_indicators: totalIndicators - approvedIndicators,
      approval_rate: approvalRate,
      evaluations: evaluationResults
    };
    
  } catch (error) {
    console.error('❌ Error al evaluar indicadores:', error);
    throw error;
  }
};

/**
 * Evalúa indicadores para todos los estudiantes de un cuestionario
 */
export const evaluateAllStudentsIndicators = async (questionnaireId) => {
  try {
    console.log(`🔍 Evaluando indicadores para todos los estudiantes del cuestionario ${questionnaireId}`);
    
    // Obtener todos los estudiantes que tienen evaluación para este cuestionario
    const [students] = await pool.query(`
      SELECT DISTINCT student_id 
      FROM evaluation_results 
      WHERE questionnaire_id = ?
    `, [questionnaireId]);
    
    console.log(`👥 Encontrados ${students.length} estudiantes para evaluar`);
    
    const results = [];
    
    for (const student of students) {
      try {
        const result = await evaluateStudentIndicators(student.student_id, questionnaireId);
        if (result.success) {
          results.push(result);
        }
      } catch (error) {
        console.error(`❌ Error evaluando estudiante ${student.student_id}:`, error);
      }
    }
    
    console.log(`✅ Evaluación completada para ${results.length} estudiantes`);
    
    return {
      success: true,
      questionnaire_id: questionnaireId,
      total_students: results.length,
      results: results
    };
    
  } catch (error) {
    console.error('❌ Error al evaluar indicadores de todos los estudiantes:', error);
    throw error;
  }
};

/**
 * Obtiene el estado de los indicadores de un estudiante
 */
export const getStudentIndicatorStatus = async (studentId, questionnaireId = null) => {
  try {
    let query = `
      SELECT 
        si.student_id,
        si.indicator_id,
        si.achieved,
        si.questionnaire_id,
        si.assigned_at,
        i.description,
        i.subject,
        i.category,
        i.grade,
        i.phase,
        qi.passing_score,
        er.best_score as student_best_score
      FROM student_indicators si
      JOIN indicators i ON si.indicator_id = i.id
      LEFT JOIN questionnaire_indicators qi ON si.indicator_id = qi.indicator_id AND si.questionnaire_id = qi.questionnaire_id
      LEFT JOIN evaluation_results er ON si.student_id = er.student_id AND si.questionnaire_id = er.questionnaire_id
      WHERE si.student_id = ?
    `;
    
    const params = [studentId];
    
    if (questionnaireId) {
      query += ' AND si.questionnaire_id = ?';
      params.push(questionnaireId);
    }
    
    query += ' ORDER BY si.questionnaire_id, si.indicator_id';
    
    const [results] = await pool.query(query, params);
    
    return {
      success: true,
      student_id: studentId,
      questionnaire_id: questionnaireId,
      indicators: results
    };
    
  } catch (error) {
    console.error('❌ Error al obtener estado de indicadores:', error);
    throw error;
  }
};
