import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { 
  getTeacherByUserId, 
  getTeacherIndicators, 
  createTeacherIfNotExists, 
  getStudentsByGrade, 
  getStudentProgressByQuestionnaire,
  //getTeacherSessions,
  getAllSessionsByRole,
  reopenSession,
  updateSession
} from '../controllers/teacherController.js';

const router = express.Router();

// Crear profesor si no existe
router.post('/create-for-user/:userId', verifyToken, createTeacherIfNotExists);

// Obtener profesor por user_id
router.get('/by-user/:userId', verifyToken, getTeacherByUserId);

// Obtener progreso por cuestionario
router.get('/progress/:questionnaireId', verifyToken, getStudentProgressByQuestionnaire);

// 🔥 IMPORTANTE: RUTA ESPECÍFICA PRIMERO
router.patch('/sessions/:sessionId/reopen', verifyToken, reopenSession);

// routes/teacherRoutes.js para actualizar
router.patch('/sessions/:sessionId', verifyToken, updateSession);


// Obtener sesiones del docente
//router.get('/:teacherId/sessions', verifyToken, getTeacherSessions);
router.get('/sessions/all', verifyToken, getAllSessionsByRole);


// Obtener indicadores
router.get('/:teacherId/indicators', verifyToken, getTeacherIndicators);

// Obtener estudiantes por grado
router.get('/:teacherId/students/by-grade/:grade', verifyToken, getStudentsByGrade);

export default router;
