import express from 'express';
import { getTeachers, getStudents, getAdminStats } from '../controllers/adminController.js';
import { 
  verifyToken, 
  isAdmin,
  isSuperAdmin,
  isAdminOrTeacher 
} from '../middleware/authMiddleware.js';

const router = express.Router();

// Aplicar verificación de token a todas las rutas
router.use(verifyToken);

// Rutas para administradores y super administradores
router.get('/teachers', isAdmin, getTeachers);
router.get('/students', isAdminOrTeacher, getStudents);

// Ruta para obtener estadísticas (solo super administradores)
router.get('/stats', isSuperAdmin, getAdminStats);

export default router;
