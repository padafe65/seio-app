// routes/auditRoutes.js
// Rutas para consultar logs de auditoría

import express from 'express';
import { verifyToken, isSuperAdmin } from '../middleware/authMiddleware.js';
import { getAuditLogs, getAuditHistory } from '../utils/auditLogger.js';

const router = express.Router();

// Aplicar verificación de token a todas las rutas
router.use(verifyToken);

/**
 * GET /audit/logs
 * Obtener todos los logs de auditoría con filtros opcionales
 * Solo super_administrador tiene acceso
 */
router.get('/logs', isSuperAdmin, async (req, res) => {
  try {
    const { tableName, userId, action, startDate, endDate, limit = 100 } = req.query;
    
    const filters = {};
    if (tableName) filters.tableName = tableName;
    if (userId) filters.userId = parseInt(userId);
    if (action) filters.action = action;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    filters.limit = parseInt(limit);
    
    const logs = await getAuditLogs(filters);
    
    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    console.error('Error al obtener logs de auditoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener logs de auditoría',
      error: error.message
    });
  }
});

/**
 * GET /audit/history/:tableName/:recordId
 * Obtener el historial de auditoría de un registro específico
 * Solo super_administrador tiene acceso
 */
router.get('/history/:tableName/:recordId', isSuperAdmin, async (req, res) => {
  try {
    const { tableName, recordId } = req.params;
    
    const history = await getAuditHistory(tableName, parseInt(recordId));
    
    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error al obtener historial de auditoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de auditoría',
      error: error.message
    });
  }
});

/**
 * GET /audit/stats
 * Obtener estadísticas de auditoría
 * Solo super_administrador tiene acceso
 */
router.get('/stats', isSuperAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Aquí puedes agregar consultas para estadísticas
    // Por ejemplo: acciones por usuario, acciones por tabla, etc.
    
    res.json({
      success: true,
      message: 'Estadísticas de auditoría (por implementar)'
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de auditoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de auditoría',
      error: error.message
    });
  }
});

export default router;
