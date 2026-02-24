import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { checkSubscription } from '../middleware/subscriptionMiddleware.js';

import { 
  getTeacherByUserId, 
  getTeacherIndicators, 
  createTeacherIfNotExists, 
  getStudentsByGrade, 
  getStudentProgressByQuestionnaire,
  getAllSessionsByRole,
  reopenSession,
  updateSession
} from '../controllers/teacherController.js';

const router = express.Router();

/* Rutas libres (login/carga inicial) */
router.post('/create-for-user/:userId', verifyToken, createTeacherIfNotExists);
router.get('/by-user/:userId', verifyToken, getTeacherByUserId);

/* Rutas protegidas */
router.get('/progress/:questionnaireId', verifyToken, checkSubscription, getStudentProgressByQuestionnaire);
router.patch('/sessions/:sessionId/reopen', verifyToken, checkSubscription, reopenSession);
router.patch('/sessions/:sessionId', verifyToken, checkSubscription, updateSession);
router.get('/sessions/all', verifyToken, checkSubscription, getAllSessionsByRole);
router.get('/:teacherId/indicators', verifyToken, checkSubscription, getTeacherIndicators);
router.get('/:teacherId/students/by-grade/:grade', verifyToken, checkSubscription, getStudentsByGrade);

export default router;