import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';
import { 
  evaluateStudentIndicators, 
  evaluateAllStudentsIndicators, 
  getStudentIndicatorStatus 
} from '../utils/evaluateIndicators.js';

const router = express.Router();

/**
 * POST /api/indicator-evaluation/evaluate/:studentId/:questionnaireId
 * Evalúa los indicadores de un estudiante específico para un cuestionario
 */
router.post('/evaluate/:studentId/:questionnaireId', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { studentId, questionnaireId } = req.params;
    
    console.log(`🎯 Evaluando indicadores para estudiante ${studentId} en cuestionario ${questionnaireId}`);
    
    const result = await evaluateStudentIndicators(studentId, questionnaireId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Indicadores evaluados exitosamente',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('Error en evaluación de indicadores:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al evaluar indicadores'
    });
  }
});

/**
 * POST /api/indicator-evaluation/evaluate-questionnaire/:questionnaireId
 * Evalúa los indicadores de todos los estudiantes de un cuestionario
 */
router.post('/evaluate-questionnaire/:questionnaireId', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    
    console.log(`🎯 Evaluando indicadores para todos los estudiantes del cuestionario ${questionnaireId}`);
    
    const result = await evaluateAllStudentsIndicators(questionnaireId);
    
    res.json({
      success: true,
      message: `Indicadores evaluados para ${result.total_students} estudiantes`,
      data: result
    });
    
  } catch (error) {
    console.error('Error en evaluación masiva de indicadores:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al evaluar indicadores'
    });
  }
});

/**
 * GET /api/indicator-evaluation/student/:studentId/status
 * Obtiene el estado de los indicadores de un estudiante
 */
router.get('/student/:studentId/status', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { questionnaireId } = req.query; // Opcional
    
    console.log(`📊 Obteniendo estado de indicadores para estudiante ${studentId}${questionnaireId ? ` en cuestionario ${questionnaireId}` : ''}`);
    
    const result = await getStudentIndicatorStatus(studentId, questionnaireId);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error al obtener estado de indicadores:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener estado de indicadores'
    });
  }
});

/**
 * GET /api/indicator-evaluation/questionnaire/:questionnaireId/statistics
 * Obtiene estadísticas de indicadores para un cuestionario
 */
router.get('/questionnaire/:questionnaireId/statistics', verifyToken, async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    
    console.log(`📊 Obteniendo estadísticas de indicadores para cuestionario ${questionnaireId}`);
    
    // Obtener estadísticas generales
    const [stats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT si.student_id) as total_students,
        COUNT(si.id) as total_evaluations,
        SUM(CASE WHEN si.achieved = 1 THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN si.achieved = 0 THEN 1 ELSE 0 END) as failed_count,
        ROUND((SUM(CASE WHEN si.achieved = 1 THEN 1 ELSE 0 END) / COUNT(si.id)) * 100, 2) as approval_rate
      FROM student_indicators si
      WHERE si.questionnaire_id = ?
    `, [questionnaireId]);
    
    // Obtener estadísticas por indicador
    const [indicatorStats] = await pool.query(`
      SELECT 
        si.indicator_id,
        i.description,
        i.subject,
        COUNT(si.id) as total_students,
        SUM(CASE WHEN si.achieved = 1 THEN 1 ELSE 0 END) as approved_students,
        SUM(CASE WHEN si.achieved = 0 THEN 1 ELSE 0 END) as failed_students,
        ROUND((SUM(CASE WHEN si.achieved = 1 THEN 1 ELSE 0 END) / COUNT(si.id)) * 100, 2) as approval_rate,
        AVG(qi.passing_score) as avg_passing_score
      FROM student_indicators si
      JOIN indicators i ON si.indicator_id = i.id
      LEFT JOIN questionnaire_indicators qi ON si.indicator_id = qi.indicator_id AND si.questionnaire_id = qi.questionnaire_id
      WHERE si.questionnaire_id = ?
      GROUP BY si.indicator_id, i.description, i.subject
      ORDER BY approval_rate DESC
    `, [questionnaireId]);
    
    res.json({
      success: true,
      data: {
        questionnaire_id: questionnaireId,
        general_stats: stats[0],
        indicator_stats: indicatorStats
      }
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas de indicadores:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener estadísticas'
    });
  }
});

export default router;
