import express from 'express';
import { getAdminStats } from '../controllers/adminStatsController.js';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Proteger la ruta para super administradores
router.use(verifyToken);
router.use(checkRole(['super_administrador']));

// Obtener estadísticas generales
router.get('/stats', getAdminStats);

export default router;
