const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

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

module.exports = router;
