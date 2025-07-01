import express from 'express';
import { getTeachers, getStudents } from '../controllers/adminController.js';
import { 
  verifyToken, 
  isAdmin,
  isAdminOrTeacher 
} from '../middleware/authMiddleware.js';

const router = express.Router();

// Aplicar verificación de token a todas las rutas
router.use(verifyToken);

// Rutas para administradores y super administradores
router.get('/teachers', isAdmin, getTeachers);
router.get('/students', isAdminOrTeacher, getStudents);

export default router;
