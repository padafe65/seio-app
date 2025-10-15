import express from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Obtener indicadores asociados a un cuestionario
router.get('/questionnaire/:questionnaireId/indicators', verifyToken, async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    
    const [indicators] = await pool.query(`
      SELECT 
        qi.id as association_id,
        qi.indicator_id,
        i.description,
        i.subject,
        i.category,
        i.grade,
        i.phase,
        qi.passing_score,
        qi.weight,
        qi.created_at
      FROM questionnaire_indicators qi
      JOIN indicators i ON qi.indicator_id = i.id
      WHERE qi.questionnaire_id = ?
      ORDER BY qi.indicator_id
    `, [questionnaireId]);
    
    res.json({
      success: true,
      data: indicators
    });
    
  } catch (error) {
    console.error('Error al obtener indicadores del cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener indicadores del cuestionario'
    });
  }
});

// Asociar indicador a cuestionario
router.post('/questionnaire/:questionnaireId/indicators', verifyToken, async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    const { indicator_id, passing_score = 3.50, weight = 1.00 } = req.body;
    
    // Verificar que el cuestionario existe
    const [questionnaire] = await pool.query(
      'SELECT id FROM questionnaires WHERE id = ?',
      [questionnaireId]
    );
    
    if (questionnaire.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cuestionario no encontrado'
      });
    }
    
    // Verificar que el indicador existe
    const [indicator] = await pool.query(
      'SELECT id FROM indicators WHERE id = ?',
      [indicator_id]
    );
    
    if (indicator.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Indicador no encontrado'
      });
    }
    
    // Crear la asociación
    const [result] = await pool.query(`
      INSERT INTO questionnaire_indicators (questionnaire_id, indicator_id, passing_score, weight)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        passing_score = VALUES(passing_score),
        weight = VALUES(weight)
    `, [questionnaireId, indicator_id, passing_score, weight]);
    
    res.json({
      success: true,
      message: 'Indicador asociado al cuestionario exitosamente',
      data: {
        association_id: result.insertId,
        questionnaire_id: questionnaireId,
        indicator_id,
        passing_score,
        weight
      }
    });
    
  } catch (error) {
    console.error('Error al asociar indicador al cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asociar indicador al cuestionario'
    });
  }
});

// Desasociar indicador de cuestionario
router.delete('/questionnaire/:questionnaireId/indicators/:indicatorId', verifyToken, async (req, res) => {
  try {
    const { questionnaireId, indicatorId } = req.params;
    
    const [result] = await pool.query(`
      DELETE FROM questionnaire_indicators 
      WHERE questionnaire_id = ? AND indicator_id = ?
    `, [questionnaireId, indicatorId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Asociación no encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Indicador desasociado del cuestionario exitosamente'
    });
    
  } catch (error) {
    console.error('Error al desasociar indicador del cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desasociar indicador del cuestionario'
    });
  }
});

// Actualizar configuración de asociación (nota de aprobación, peso)
router.put('/questionnaire/:questionnaireId/indicators/:indicatorId', verifyToken, async (req, res) => {
  try {
    const { questionnaireId, indicatorId } = req.params;
    const { passing_score, weight } = req.body;
    
    const [result] = await pool.query(`
      UPDATE questionnaire_indicators 
      SET passing_score = ?, weight = ?
      WHERE questionnaire_id = ? AND indicator_id = ?
    `, [passing_score, weight, questionnaireId, indicatorId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Asociación no encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Configuración de asociación actualizada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar configuración de asociación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración de asociación'
    });
  }
});

// Obtener cuestionarios asociados a un indicador
router.get('/indicator/:indicatorId/questionnaires', verifyToken, async (req, res) => {
  try {
    const { indicatorId } = req.params;
    
    const [questionnaires] = await pool.query(`
      SELECT 
        qi.id as association_id,
        qi.questionnaire_id,
        q.title,
        q.subject,
        q.category,
        q.grade,
        q.phase,
        qi.passing_score,
        qi.weight,
        qi.created_at
      FROM questionnaire_indicators qi
      JOIN questionnaires q ON qi.questionnaire_id = q.id
      WHERE qi.indicator_id = ?
      ORDER BY qi.questionnaire_id
    `, [indicatorId]);
    
    res.json({
      success: true,
      data: questionnaires
    });
    
  } catch (error) {
    console.error('Error al obtener cuestionarios del indicador:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cuestionarios del indicador'
    });
  }
});

// Evaluar manualmente indicadores de un estudiante para un cuestionario
router.post('/evaluate/:studentId/questionnaire/:questionnaireId', verifyToken, async (req, res) => {
  try {
    const { studentId, questionnaireId } = req.params;
    
    // Obtener la mejor nota del estudiante en el cuestionario
    const [evaluation] = await pool.query(`
      SELECT best_score 
      FROM evaluation_results 
      WHERE student_id = ? AND questionnaire_id = ?
    `, [studentId, questionnaireId]);
    
    if (evaluation.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró evaluación para este estudiante y cuestionario'
      });
    }
    
    const bestScore = evaluation[0].best_score;
    
    // Obtener indicadores asociados al cuestionario
    const [indicators] = await pool.query(`
      SELECT indicator_id, passing_score
      FROM questionnaire_indicators
      WHERE questionnaire_id = ?
    `, [questionnaireId]);
    
    const results = [];
    
    // Evaluar cada indicador
    for (const indicator of indicators) {
      const achieved = bestScore >= indicator.passing_score ? 1 : 0;
      
      // Actualizar o insertar en student_indicators
      await pool.query(`
        INSERT INTO student_indicators (student_id, indicator_id, achieved, questionnaire_id, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          achieved = VALUES(achieved),
          questionnaire_id = VALUES(questionnaire_id),
          updated_at = CURRENT_TIMESTAMP
      `, [studentId, indicator.indicator_id, achieved, questionnaireId]);
      
      results.push({
        indicator_id: indicator.indicator_id,
        passing_score: indicator.passing_score,
        student_score: bestScore,
        achieved: achieved === 1,
        status: achieved === 1 ? 'APROBADO' : 'REPROBADO'
      });
    }
    
    res.json({
      success: true,
      message: 'Indicadores evaluados exitosamente',
      data: {
        student_id: studentId,
        questionnaire_id: questionnaireId,
        best_score: bestScore,
        indicators: results
      }
    });
    
  } catch (error) {
    console.error('Error al evaluar indicadores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al evaluar indicadores'
    });
  }
});

export default router;
