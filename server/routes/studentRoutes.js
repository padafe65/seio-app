const express = require('express');
const router = express.Router();
const { verificarToken, esDocente, esSuperAdmin } = require('../middleware/authMiddleware');
const studentController = require('../controllers/studentController');

// Obtener todos los estudiantes (solo super administrador)
router.get('/', [verificarToken, esSuperAdmin], studentController.getStudents);

// Obtener un estudiante por ID (docente puede ver sus propios estudiantes)
router.get('/:id', verificarToken, studentController.getStudentById);

module.exports = router;
