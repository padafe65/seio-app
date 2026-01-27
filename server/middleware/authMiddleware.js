// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

/**
 * Middleware para verificar el token JWT
 */
export const verifyToken = async (req, res, next) => {
  try {
    // Obtener el token del encabezado de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'Acceso denegado. No se proporcionó token de autenticación.',
        code: 'AUTH_TOKEN_MISSING'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token de autenticación no válido.',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Verificar el token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar si el usuario existe en la base de datos
      const [user] = await pool.query(
        'SELECT id, email, role, estado FROM users WHERE id = ?',
        [decoded.id]
      );

      if (!user || user.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no encontrado.',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verificar si el usuario está activo
      if (user[0].estado !== 'activo') {
        return res.status(403).json({
          success: false,
          error: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // Añadir información del usuario al objeto de solicitud
      req.user = {
        id: user[0].id,
        email: user[0].email,
        role: user[0].role,
        ...(user[0].teacher_id && { teacher_id: user[0].teacher_id }),
        ...(user[0].student_id && { student_id: user[0].student_id })
      };

      // Si es docente o estudiante, obtener el ID correspondiente
      if (user[0].role === 'docente') {
        const [teacher] = await pool.query(
          'SELECT id FROM teachers WHERE user_id = ?',
          [user[0].id]
        );
        if (teacher && teacher.length > 0) {
          req.user.teacher_id = teacher[0].id;
        }
      } else if (user[0].role === 'estudiante') {
        const [student] = await pool.query(
          'SELECT id FROM students WHERE user_id = ?',
          [user[0].id]
        );
        if (student && student.length > 0) {
          req.user.student_id = student[0].id;
        }
      }

      next();
    } catch (error) {
      console.error('Error al verificar token:', error);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'La sesión ha expirado. Por favor, inicia sesión nuevamente.',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Token de autenticación no válido.',
        code: 'INVALID_TOKEN',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Error en el middleware de autenticación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor al procesar la autenticación.',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};

/**
 * Middleware para verificar si el usuario es super_administrador
 */
export const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'super_administrador') {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: 'Acceso denegado. Se requieren privilegios de super administrador.',
    code: 'SUPER_ADMIN_ACCESS_REQUIRED',
    userRole: req.user?.role
  });
};

/**
 * Middleware para verificar si el usuario es administrador o super_administrador
 */
export const isAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'administrador' || req.user.role === 'super_administrador') {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: 'Acceso denegado. Se requieren privilegios de administrador o super administrador.',
    code: 'ADMIN_ACCESS_REQUIRED',
    userRole: req.user.role
  });
};

/**
 * Middleware para verificar si el usuario es administrador, super_administrador o docente
 */
export const isTeacherOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'administrador' || req.user.role === 'super_administrador' || req.user.role === 'docente') {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: 'Acceso denegado. Se requiere rol de administrador, super administrador o docente.',
    code: 'TEACHER_OR_ADMIN_REQUIRED',
    userRole: req.user.role
  });
};

/**
 * Middleware para verificar si el usuario es el propietario del recurso o admin
 */
export const isOwnerOrAdmin = (resourceOwnerId) => {
  return (req, res, next) => {
    if (req.user.role === 'admin' || req.user.id === resourceOwnerId) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para acceder a este recurso.',
      code: 'OWNERSHIP_REQUIRED',
      requiredRole: 'admin',
      userRole: req.user.role
    });
  };
};

/**
 * Middleware para verificar si el usuario es el profesor asignado o admin
 */
export const isAssignedTeacherOrAdmin = (teacherId) => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'admin') {
        return next();
      }
      
      if (req.user.role === 'docente' && req.user.teacher_id === teacherId) {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para acceder a este recurso.',
        code: 'TEACHER_ACCESS_DENIED',
        userRole: req.user.role,
        required: 'admin o docente asignado'
      });
    } catch (error) {
      console.error('Error en isAssignedTeacherOrAdmin:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al verificar permisos del docente.',
        code: 'TEACHER_PERMISSION_CHECK_FAILED'
      });
    }
  };
};

/**
 * Middleware para validar que un docente solo puede crear contenido de SU materia asignada
 * Previene préstamo de licencias y uso de materias no autorizadas
 */
export const validateTeacherSubject = async (req, res, next) => {
  try {
    // Si no es docente, permitir (admins pueden crear cualquier contenido)
    if (req.user.role !== 'docente') {
      return next();
    }

    const userId = req.user.id;
    const requestedSubject = req.body.subject;

    // Obtener la materia asignada al docente
    const [teacherRows] = await pool.query(
      'SELECT id, subject FROM teachers WHERE user_id = ?',
      [userId]
    );

    if (teacherRows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No eres un docente registrado. Solo los docentes pueden crear este tipo de contenido.',
        code: 'TEACHER_NOT_REGISTERED',
        userRole: req.user.role
      });
    }

    const teacherSubject = teacherRows[0].subject;
    const teacherId = teacherRows[0].id;

    // Si no se proporciona subject en el body, usar la materia del docente
    if (!requestedSubject) {
      req.body.subject = teacherSubject;
      req.body.teacher_id = teacherId;
      console.log(`✅ Subject asignado automáticamente: ${teacherSubject} para docente ${userId}`);
      return next();
    }

    // Validar que el subject solicitado coincide con la materia del docente
    if (requestedSubject !== teacherSubject) {
      return res.status(403).json({
        success: false,
        message: `Solo puedes crear contenido de tu materia asignada: "${teacherSubject}". Intentaste crear contenido de: "${requestedSubject}".`,
        code: 'SUBJECT_MISMATCH',
        yourSubject: teacherSubject,
        attemptedSubject: requestedSubject
      });
    }

    // Asegurar que teacher_id está en el body para referencias futuras
    req.body.teacher_id = teacherId;
    req.body.subject = teacherSubject; // Forzar el subject correcto

    console.log(`✅ Validación de materia exitosa: docente ${userId} creando contenido de ${teacherSubject}`);
    next();
  } catch (error) {
    console.error('❌ Error en validateTeacherSubject:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al validar la materia del docente.',
      code: 'SUBJECT_VALIDATION_ERROR'
    });
  }
};
