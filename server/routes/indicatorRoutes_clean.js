// routes/indicatorRoutes.js
import express from 'express';
import { 
  getIndicators,
  getIndicatorById,
  createIndicator,
  updateIndicator,
  deleteIndicator,
  getStudentIndicators,
  getIndicatorStudents,
  removeStudentFromIndicator,
  getTeacherQuestionnaires
} from '../controllers/indicatorController.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Obtener todos los indicadores (con filtros opcionales)
router.get('/', verifyToken, getIndicators);

// Obtener un indicador específico
router.get('/:id', verifyToken, getIndicatorById);

// Crear un nuevo indicador
router.post('/', verifyToken, createIndicator);

// Actualizar un indicador existente
router.put('/:id', verifyToken, updateIndicator);

// Eliminar un indicador
router.delete('/:id', verifyToken, deleteIndicator);

// Obtener indicadores de un estudiante
router.get('/student/:userId', verifyToken, getStudentIndicators);

// Obtener estudiantes de un indicador
router.get('/:id/students', verifyToken, getIndicatorStudents);

// Eliminar un estudiante de un indicador
router.delete('/:indicatorId/students/:studentId', 
  verifyToken,
  isTeacherOrAdmin,
  removeStudentFromIndicator
);

// Obtener cuestionarios de un docente
router.get('/questionnaires/teacher/:userId', verifyToken, getTeacherQuestionnaires);

export default router;
