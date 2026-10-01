// utils/auditLogger.js
// Sistema de auditoría para rastrear todos los cambios en el sistema

import pool from '../config/db.js';

/**
 * Registra una acción en el log de auditoría
 * @param {Object} params - Parámetros del log
 * @param {string} params.action - Acción realizada (CREATE, UPDATE, DELETE, LOGIN, etc.)
 * @param {string} params.tableName - Nombre de la tabla afectada
 * @param {number} params.recordId - ID del registro afectado
 * @param {number} params.userId - ID del usuario que realizó la acción
 * @param {string} params.userRole - Rol del usuario
 * @param {string} params.userName - Nombre del usuario
 * @param {string} params.description - Descripción de la acción
 * @param {Object} params.oldValues - Valores anteriores (opcional)
 * @param {Object} params.newValues - Valores nuevos (opcional)
 * @param {string} params.ipAddress - Dirección IP (opcional)
 * @param {string} params.userAgent - User agent del navegador (opcional)
 */
export const logAudit = async ({
  action,
  tableName,
  recordId = null,
  userId,
  userRole,
  userName,
  description,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null
}) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs 
       (action, table_name, record_id, user_id, user_role, user_name, description, 
        old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        action,
        tableName,
        recordId,
        userId,
        userRole,
        userName,
        description,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]
    );
    
    console.log(`📝 [AUDIT] ${action} en ${tableName} por ${userName} (${userRole})`);
  } catch (error) {
    console.error('❌ Error al registrar auditoría:', error);
    // No lanzar error para no interrumpir la operación principal
  }
};

/**
 * Registra la creación de un registro
 */
export const logCreate = async (tableName, recordId, userId, userRole, userName, newValues, req = null) => {
  return logAudit({
    action: 'CREATE',
    tableName,
    recordId,
    userId,
    userRole,
    userName,
    description: `Creó un nuevo registro en ${tableName} (ID: ${recordId})`,
    newValues,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('user-agent')
  });
};

/**
 * Registra la actualización de un registro
 */
export const logUpdate = async (tableName, recordId, userId, userRole, userName, oldValues, newValues, req = null) => {
  // Filtrar solo los campos que cambiaron
  const changes = {};
  const oldChanges = {};
  
  for (const key in newValues) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changes[key] = newValues[key];
      oldChanges[key] = oldValues[key];
    }
  }
  
  if (Object.keys(changes).length === 0) {
    return; // No hay cambios, no registrar
  }
  
  return logAudit({
    action: 'UPDATE',
    tableName,
    recordId,
    userId,
    userRole,
    userName,
    description: `Actualizó el registro en ${tableName} (ID: ${recordId}). Campos modificados: ${Object.keys(changes).join(', ')}`,
    oldValues: oldChanges,
    newValues: changes,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('user-agent')
  });
};

/**
 * Registra la eliminación de un registro
 */
export const logDelete = async (tableName, recordId, userId, userRole, userName, oldValues, req = null) => {
  return logAudit({
    action: 'DELETE',
    tableName,
    recordId,
    userId,
    userRole,
    userName,
    description: `Eliminó el registro en ${tableName} (ID: ${recordId})`,
    oldValues,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('user-agent')
  });
};

/**
 * Registra un inicio de sesión
 */
export const logLogin = async (userId, userRole, userName, success = true, req = null) => {
  return logAudit({
    action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
    tableName: 'users',
    recordId: userId,
    userId: userId || 0,
    userRole: userRole || 'unknown',
    userName: userName || 'Desconocido',
    description: success 
      ? `Inicio de sesión exitoso de ${userName}` 
      : `Intento de inicio de sesión fallido para ${userName}`,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('user-agent')
  });
};

/**
 * Registra un cierre de sesión
 */
export const logLogout = async (userId, userRole, userName, req = null) => {
  return logAudit({
    action: 'LOGOUT',
    tableName: 'users',
    recordId: userId,
    userId,
    userRole,
    userName,
    description: `Cerró sesión ${userName}`,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('user-agent')
  });
};

/**
 * Obtiene el historial de auditoría de un registro específico
 */
export const getAuditHistory = async (tableName, recordId) => {
  try {
    const [logs] = await pool.query(
      `SELECT al.*, u.name AS current_user_name, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.table_name = ? AND al.record_id = ?
       ORDER BY al.created_at DESC`,
      [tableName, recordId]
    );
    return logs;
  } catch (error) {
    console.error('Error al obtener historial de auditoría:', error);
    return [];
  }
};

/**
 * Obtiene los logs de auditoría con filtros
 */
export const getAuditLogs = async (filters = {}) => {
  try {
    let query = `
      SELECT al.*, u.name AS current_user_name, u.email AS user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.tableName) {
      query += ' AND al.table_name = ?';
      params.push(filters.tableName);
    }
    
    if (filters.userId) {
      query += ' AND al.user_id = ?';
      params.push(filters.userId);
    }
    
    if (filters.action) {
      query += ' AND al.action = ?';
      params.push(filters.action);
    }
    
    if (filters.startDate) {
      query += ' AND al.created_at >= ?';
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      // Los filtros vienen de un input date (YYYY-MM-DD); excluir el día
      // siguiente incluye todas las horas del día seleccionado.
      query += ' AND al.created_at < DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(filters.endDate);
    }
    
    query += ' ORDER BY al.created_at DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }
    
    const [logs] = await pool.query(query, params);
    return logs;
  } catch (error) {
    console.error('Error al obtener logs de auditoría:', error);
    throw error;
  }
};

// Registra mutaciones desde rutas autenticadas usando la identidad de req.user.
// Mantiene valores de auditoría explícitos para que cada módulo indique qué cambió.
export const logRequestAudit = (req, event) => logAudit({
  ...event,
  userId: req?.user?.id ?? 0,
  userRole: req?.user?.role || 'unknown',
  userName: req?.user?.name || req?.user?.email || 'Usuario',
  ipAddress: req?.ip || req?.connection?.remoteAddress || null,
  userAgent: req?.get?.('user-agent') || null
});

export default {
  logAudit,
  logRequestAudit,
  logCreate,
  logUpdate,
  logDelete,
  logLogin,
  logLogout,
  getAuditHistory,
  getAuditLogs
};
