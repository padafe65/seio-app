import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false,
      message: 'No se proporcionó token de autenticación.',
      error: 'MISSING_TOKEN'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Obtener información adicional del usuario desde la base de datos
    const [users] = await pool.query(
      'SELECT u.*, t.id as teacher_id, s.id as student_id ' +
      'FROM users u ' +
      'LEFT JOIN teachers t ON t.user_id = u.id ' +
      'LEFT JOIN students s ON s.user_id = u.id ' +
      'WHERE u.id = ?', 
      [decoded.id]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado en la base de datos.',
        error: 'USER_NOT_FOUND'
      });
    }

    const user = users[0];
    
    // Agregar información del usuario al objeto de solicitud
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      teacher_id: user.teacher_id,
      student_id: user.student_id
    };
    
    next();
  } catch (error) {
    console.error('Error en verifyToken:', error);
    
    let errorMessage = 'Error de autenticación';
    let errorCode = 'AUTH_ERROR';
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'La sesión ha expirado. Por favor inicia sesión nuevamente.';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Token de autenticación inválido.';
      errorCode = 'INVALID_TOKEN';
    }
    
    res.status(401).json({ 
      success: false,
      message: errorMessage,
      error: errorCode
    });
  }
};

export const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'No autenticado. Por favor inicia sesión.',
        error: 'UNAUTHORIZED'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      const roles = allowedRoles.join(' o ');
      return res.status(403).json({ 
        success: false,
        message: `Acceso denegado. Se requiere uno de los siguientes roles: ${roles}.`,
        error: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        currentRole: req.user.role
      });
    }
    
    next();
  };
};

// Middleware específico para verificar si es docente o admin
export const isTeacherOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'No autenticado. Por favor inicia sesión.',
      error: 'UNAUTHORIZED'
    });
  }
  
  if (req.user.role !== 'docente' && req.user.role !== 'super_administrador') {
    return res.status(403).json({ 
      success: false,
      message: 'Acceso denegado. Se requiere rol de docente o administrador.',
      error: 'FORBIDDEN'
    });
  }
  
  next();
};

// Middleware específico para verificar si es admin
export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'No autenticado. Por favor inicia sesión.',
      error: 'UNAUTHORIZED'
    });
  }
  
  if (req.user.role !== 'super_administrador') {
    return res.status(403).json({ 
      success: false,
      message: 'Acceso denegado. Se requiere rol de administrador.',
      error: 'FORBIDDEN'
    });
  }
  
  next();
};
