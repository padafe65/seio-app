import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Ruta para obtener estadísticas del administrador
router.get('/stats', 
  verifyToken, 
  checkRole(['super_administrador']), 
  adminController.getAdminStats
);

// Ruta para obtener todos los estudiantes
router.get('/students', 
  verifyToken, 
  checkRole(['super_administrador']), 
  adminController.getStudents
);

// Ruta para obtener todos los docentes
router.get('/teachers', 
  verifyToken, 
  checkRole(['super_administrador']), 
  adminController.getTeachers
);

export default router;
