// routes/phaseEvaluation.js
import express from 'express';
import { evaluatePhaseResults } from '../services/phaseEvaluationService.js';
import pool from '../config/db.js';

const router = express.Router();

// Ruta para iniciar la evaluación de una fase específica
router.post('/evaluate-phase/:phase', async (req, res) => {
  try {
    const { phase } = req.params;
    
    // Validar que la fase sea un número entre 1 y 4
    const phaseNum = parseInt(phase);
    if (isNaN(phaseNum) || phaseNum < 1 || phaseNum > 4) {
      return res.status(400).json({ message: 'Fase inválida. Debe ser un número entre 1 y 4.' });
    }
    
    const result = await evaluatePhaseResults(phaseNum);
    
    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(500).json({ message: 'Error en la evaluación de fase', error: result.error });
    }
  } catch (error) {
    console.error('Error en evaluación de fase:', error);
    res.status(500).json({ message: 'Error en la evaluación de fase' });
  }
});

// Ruta para obtener estadísticas de una fase
router.get('/phase-stats/:phase', async (req, res) => {
  try {
    const { phase } = req.params;
    
    // Validar que la fase sea un número entre 1 y 4
    const phaseNum = parseInt(phase);
    if (isNaN(phaseNum) || phaseNum < 1 || phaseNum > 4) {
      return res.status(400).json({ message: 'Fase inválida. Debe ser un número entre 1 y 4.' });
    }
    
    // Obtener estadísticas de la fase
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_students,
        SUM(CASE WHEN phase${phaseNum} >= 3.5 THEN 1 ELSE 0 END) as approved_students,
        SUM(CASE WHEN phase${phaseNum} < 3.5 THEN 1 ELSE 0 END) as failed_students,
        AVG(phase${phaseNum}) as average_score
      FROM grades
      WHERE phase${phaseNum} IS NOT NULL
    `);
    
    res.json(stats[0]);
  } catch (error) {
    console.error('Error al obtener estadísticas de fase:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas de fase' });
  }
});

export default router;
