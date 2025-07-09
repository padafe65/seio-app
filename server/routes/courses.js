// routes/courses.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Obtener todos los cursos
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name FROM courses ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener cursos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener cursos' });
  }
});

// Obtener un curso por ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    
    res.json({ success: true, course: rows[0] });
  } catch (error) {
    console.error('❌ Error al obtener curso:', error);
    res.status(500).json({ success: false, message: 'Error al obtener curso' });
  }
});

// Crear un nuevo curso (solo administradores)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, description, grade } = req.body;
    
    // Validar datos
    if (!name) {
      return res.status(400).json({ success: false, message: 'El nombre del curso es requerido' });
    }
    
    // Verificar si el curso ya existe
    const [existing] = await pool.query('SELECT id FROM courses WHERE name = ?', [name]);
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Ya existe un curso con este nombre' });
    }
    
    // Crear el curso
    const [result] = await pool.query(
      'INSERT INTO courses (name, description, grade) VALUES (?, ?, ?)',
      [name, description || null, grade || null]
    );
    
    res.status(201).json({
      success: true,
      message: 'Curso creado correctamente',
      courseId: result.insertId
    });
  } catch (error) {
    console.error('❌ Error al crear curso:', error);
    res.status(500).json({ success: false, message: 'Error al crear curso' });
  }
});

// Actualizar un curso (solo administradores)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, grade } = req.body;
    
    // Verificar si el curso existe
    const [existing] = await pool.query('SELECT id FROM courses WHERE id = ?', [id]);
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    
    // Actualizar el curso
    await pool.query(
      'UPDATE courses SET name = ?, description = ?, grade = ? WHERE id = ?',
      [name, description, grade, id]
    );
    
    res.json({
      success: true,
      message: 'Curso actualizado correctamente'
    });
  } catch (error) {
    console.error('❌ Error al actualizar curso:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar curso' });
  }
});

// Eliminar un curso (solo administradores)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el curso existe
    const [existing] = await pool.query('SELECT id FROM courses WHERE id = ?', [id]);
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    
    // Verificar si hay estudiantes en este curso
    const [students] = await pool.query('SELECT id FROM students WHERE course_id = ?', [id]);
    
    if (students.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el curso porque tiene estudiantes asignados'
      });
    }
    
    // Eliminar el curso
    await pool.query('DELETE FROM courses WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Curso eliminado correctamente'
    });
  } catch (error) {
    console.error('❌ Error al eliminar curso:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar curso' });
  }
});

export default router;
