// backend/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false,
      message: 'No se proporcionó un token de autenticación válido.',
      error: 'MISSING_TOKEN'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    if (!process.env.JWT_SECRET) {
      console.error('❌ FATAL: JWT_SECRET no está configurado en las variables de entorno.');
      return res.status(500).json({ success: false, message: 'Error de configuración del servidor.', error: 'JWT_SECRET_NOT_SET' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ success: false, message: 'Token inválido: no contiene ID de usuario.', error: 'INVALID_TOKEN_PAYLOAD' });
    }
    
    // Consulta optimizada para obtener toda la info del usuario y sus roles de una vez.
    const query = `
      SELECT 
        u.id, u.name, u.email, u.role,
        t.id as teacher_id,
        s.id as student_id
      FROM users u
      LEFT JOIN teachers t ON t.user_id = u.id
      LEFT JOIN students s ON s.user_id = u.id
      WHERE u.id = ?
    `;
    const [users] = await pool.query(query, [decoded.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'El usuario asociado al token ya no existe.', error: 'USER_NOT_FOUND' });
    }

    // Adjuntamos toda la información útil al objeto `req.user`
    req.user = users[0];
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token de autenticación inválido.', error: 'INVALID_TOKEN' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'La sesión ha expirado. Por favor, inicia sesión nuevamente.', error: 'TOKEN_EXPIRED' });
    }
    
    console.error('❌ Error desconocido en verifyToken:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor durante la verificación del token.', error: 'INTERNAL_AUTH_ERROR' });
  }
};

export const checkRole = (allowedRoles) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ success: false, message: 'No autenticado. Se requiere iniciar sesión.', error: 'UNAUTHENTICATED' });
  }
  
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}.`,
      error: 'FORBIDDEN_ROLE'
    });
  }
  
  next();
};

// Middleware para verificar si es docente o superadmin. Es un atajo para checkRole.
export const isTeacherOrAdmin = checkRole(['docente', 'super_administrador']);

// Middleware para verificar si es admin. Es un atajo para checkRole.
export const isAdmin = checkRole(['super_administrador']);