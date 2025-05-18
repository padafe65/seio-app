// routes/teacherCoursesRoutes.js
import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// Obtener todos los cursos asignados a un profesor
// routes/teacherCoursesRoutes.js
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    const [rows] = await pool.query(`
      SELECT tc.id, c.id as course_id, c.name as course_name
      FROM teacher_courses tc
      JOIN courses c ON tc.course_id = c.id
      WHERE tc.teacher_id = ?
    `, [teacherId]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener cursos del profesor:', error);
    res.status(500).json({ message: 'Error al obtener cursos del profesor' });
  }
});


// Obtener el ID del profesor a partir del ID de usuario
router.get('/teacher-id/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [rows] = await pool.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    res.json({ teacherId: rows[0].id });
  } catch (error) {
    console.error('Error al obtener ID del profesor:', error);
    res.status(500).json({ message: 'Error al obtener ID del profesor' });
  }
});

// Asignar un curso a un profesor
router.post('/', async (req, res) => {
  try {
    const { teacher_id, course_id } = req.body;
    
    // Verificar si la asignación ya existe
    const [existing] = await pool.query(
      'SELECT * FROM teacher_courses WHERE teacher_id = ? AND course_id = ?',
      [teacher_id, course_id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Este curso ya está asignado al profesor' });
    }
    
    // Crear la asignación
    const [result] = await pool.query(
      'INSERT INTO teacher_courses (teacher_id, course_id) VALUES (?, ?)',
      [teacher_id, course_id]
    );
    
    res.status(201).json({ 
      id: result.insertId,
      teacher_id,
      course_id,
      message: 'Curso asignado correctamente al profesor'
    });
  } catch (error) {
    console.error('Error al asignar curso:', error);
    res.status(500).json({ message: 'Error al asignar curso' });
  }
});

// Eliminar la asignación de un curso a un profesor
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.query(
      'DELETE FROM teacher_courses WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }
    
    res.json({ message: 'Asignación eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar asignación:', error);
    res.status(500).json({ message: 'Error al eliminar asignación' });
  }
});

export default router;
