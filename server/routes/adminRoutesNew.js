import express from 'express';
import {
  createTeacher,
  updateUserStatus,
  updateUserRole
} from '../controllers/adminController.js';
import { verifyToken, isSuperAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Ruta para crear un nuevo docente
router.post('/teachers', [verifyToken, isSuperAdmin], createTeacher);

// Ruta para actualizar el estado de un usuario (activar/desactivar)
router.patch('/users/:userId/status', [verifyToken, isSuperAdmin], updateUserStatus);

// Ruta para actualizar el rol de un usuario
router.patch('/users/:userId/role', [verifyToken, isSuperAdmin], updateUserRole);

export default router;
