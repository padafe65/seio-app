import express from 'express';
import { verifyToken, isAdmin, isTeacher, isStudent } from '../middleware/authMiddleware.js';
import { getStudentAttempts, getStudentAttemptById } from '../controllers/studentAttemptsController.js';

const router = express.Router();

// Middleware para verificar si el usuario es el estudiante dueño del recurso, admin o profesor
const checkStudentAccess = (req, res, next) => {
  const { studentId } = req.params;
  
  // Si es admin o profesor, permitir acceso
  if (req.user.role === 'admin' || req.user.role === 'profesor' || req.user.role === 'super_administrador') {
    return next();
  }
  
  // Si es estudiante, verificar que sea el dueño del recurso
  if (req.user.role === 'estudiante' && req.user.id.toString() === studentId) {
    return next();
  }
  
  // Si no cumple ninguna condición, denegar acceso
  return res.status(403).json({ error: 'No tienes permiso para acceder a este recurso' });
};

// Obtener todos los intentos de un estudiante
router.get('/:studentId/attempts', verifyToken, checkStudentAccess, getStudentAttempts);

// Obtener un intento específico de un estudiante
router.get('/:studentId/attempts/:attemptId', verifyToken, checkStudentAccess, getStudentAttemptById);

export default router;
