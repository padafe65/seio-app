// backend-rifa/routes/rifaRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/admin/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, username, role FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

export default router;
