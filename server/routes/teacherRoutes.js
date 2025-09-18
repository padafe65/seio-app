import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { getTeacherByUserId, getTeacherIndicators, createTeacherIfNotExists, getStudentsByGrade } from '../controllers/teacherController.js';

const router = express.Router();

// Ruta para crear un registro de profesor si no existe
router.post('/create-for-user/:userId', verifyToken, createTeacherIfNotExists);

// Obtener información de un profesor por su user_id
router.get('/by-user/:userId', verifyToken, getTeacherByUserId);

// Obtener indicadores de un profesor específico
router.get('/:teacherId/indicators', verifyToken, getTeacherIndicators);

// Obtener estudiantes de un docente filtrados por grado
router.get('/:teacherId/students/by-grade/:grade', verifyToken, getStudentsByGrade);

export default router;
