// Obtener todos los cuestionarios
// routes/questionnaireRoutes.js
import express from 'express';
import pool from '../config/db.js';

const router = express.Router();
//const pool = require('../config/db'); // Asegúrate de que este sea el path correcto a tu archivo de conexión MySQL

// ✅ Obtener todos los cuestionarios
router.get('/questionnaires', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, title, category, grade, phase FROM questionnaires');
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener cuestionarios:', error);
    res.status(500).json({ message: 'Error al obtener cuestionarios' });
  }
});

export default router;
