// routes/students.js
import express from 'express';
import pool from '../config/db.js';
const router = express.Router();

// Obtener todos los estudiantes con información de curso
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, c.name as course_name, u.name 
      FROM students s
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.user_id = u.id
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener estudiantes:', err);
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// Obtener un estudiante por ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, c.name as course_name, u.name 
      FROM students s
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al obtener estudiante:', err);
    res.status(500).json({ error: 'Error al obtener estudiante' });
  }
});

// Crear un nuevo estudiante
router.post('/', async (req, res) => {
  const { name, contact_email, contact_phone, grade, course_id, age, teacher_id } = req.body;
  
  try {
    // Primero crear el usuario
    const [userResult] = await pool.query(
      'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
      [name, contact_email, contact_phone, '$2b$10$Y.jOcb0rM2Y1GS.cLyBGjOmWlp76XRy2.glIK/jlanPpPEO0M2fUu', 'estudiante']
    );
    
    const userId = userResult.insertId;
    
    // Luego crear el estudiante
    const [studentResult] = await pool.query(
      'INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, contact_phone, contact_email, age, grade, course_id]
    );
    
    const studentId = studentResult.insertId;
    
    // Si se proporcionó un teacher_id, crear la relación en teacher_students
    if (teacher_id) {
      await pool.query(
        'INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)',
        [teacher_id, studentId]
      );
    }
    
    res.status(201).json({ 
      message: 'Estudiante creado correctamente',
      studentId: studentId 
    });
  } catch (err) {
    console.error('Error al crear estudiante:', err);
    res.status(500).json({ error: 'Error al crear estudiante' });
  }
});

// Actualizar un estudiante
router.put('/:id', async (req, res) => {
  const { name, contact_email, contact_phone, grade, course_id, age, teacher_id } = req.body;
  const { id } = req.params;
  
  try {
    // Obtener el user_id del estudiante
    const [studentRows] = await pool.query(
      'SELECT user_id FROM students WHERE id = ?',
      [id]
    );
    
    if (studentRows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    
    const userId = studentRows[0].user_id;
    
    // Actualizar el usuario
    await pool.query(
      'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name, contact_email, contact_phone, userId]
    );
    
    // Actualizar el estudiante
    await pool.query(
      'UPDATE students SET contact_phone = ?, contact_email = ?, age = ?, grade = ?, course_id = ? WHERE id = ?',
      [contact_phone, contact_email, age, grade, course_id, id]
    );
    
    // Si se proporcionó un teacher_id, actualizar la relación en teacher_students
    if (teacher_id) {
      // Verificar si ya existe una relación
      const [existingRelation] = await pool.query(
        'SELECT * FROM teacher_students WHERE student_id = ?',
        [id]
      );
      
      if (existingRelation.length > 0) {
        // Actualizar la relación existente
        await pool.query(
          'UPDATE teacher_students SET teacher_id = ? WHERE student_id = ?',
          [teacher_id, id]
        );
      } else {
        // Crear una nueva relación
        await pool.query(
          'INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)',
          [teacher_id, id]
        );
      }
    }
    
    res.json({ message: 'Estudiante actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar estudiante:', err);
    res.status(500).json({ error: 'Error al actualizar estudiante' });
  }
});

// Eliminar un estudiante
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Obtener el user_id del estudiante
    const [studentRows] = await pool.query(
      'SELECT user_id FROM students WHERE id = ?',
      [id]
    );
    
    if (studentRows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    
    const userId = studentRows[0].user_id;
    
    // Eliminar las relaciones en teacher_students
    await pool.query('DELETE FROM teacher_students WHERE student_id = ?', [id]);
    
    // Eliminar el estudiante
    await pool.query('DELETE FROM students WHERE id = ?', [id]);
    
    // Eliminar el usuario
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    
    res.json({ message: 'Estudiante eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar estudiante:', err);
    res.status(500).json({ error: 'Error al eliminar estudiante' });
  }
});

export default router;
