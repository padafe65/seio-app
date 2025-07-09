// routes/students.js
import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Aplicar middleware de verificación de token a todas las rutas
router.use(verifyToken);

// Obtener todos los estudiantes con información de curso
router.get('/', isTeacherOrAdmin, async (req, res) => {
  try {
    let query = `
      SELECT s.*, c.name as course_name, u.name, u.email, u.phone, u.role 
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
    `;
    
    // Si es docente, solo mostrar sus estudiantes
    if (req.user.role === 'docente') {
      query += ` JOIN teacher_students ts ON s.id = ts.student_id 
                JOIN teachers t ON ts.teacher_id = t.id 
                WHERE t.user_id = ?`;
      const [rows] = await pool.query(query, [req.user.id]);
      return res.json(rows);
    }
    
    // Si es admin, mostrar todos los estudiantes
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error al obtener estudiantes:', err);
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// Obtener estudiantes con datos completos (para dashboard)
router.get('/complete', isTeacherOrAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id, s.user_id, s.contact_phone, s.contact_email, s.age, s.grade, s.course_id,
        u.name, u.email, u.phone, u.role, u.created_at,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener estudiantes:', error);
    res.status(500).json({ message: 'Error al obtener estudiantes' });
  }
});

// Obtener un estudiante por ID
router.get('/:id', isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(`
      SELECT 
        s.id, s.user_id, s.contact_phone, s.contact_email, s.age, s.grade, s.course_id,
        u.name, u.email, u.phone, u.role,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error al obtener estudiante:', error);
    res.status(500).json({ message: 'Error al obtener estudiante' });
  }
});

// Crear un nuevo estudiante
router.post('/', isTeacherOrAdmin, async (req, res) => {
  try {
    // MODIFICADO: Añadimos 'phone' y 'email' para el estudiante
    const { user_id, name, phone, email, contact_phone, contact_email, age, grade, course_id, teacher_id } = req.body;

    console.log("Datos recibidos para estudiante:", req.body);

    // Si no hay user_id pero hay name, crear primero el usuario
    let userId = user_id;

    if (!userId && name) {
      // Crear un nuevo usuario
      const hashedPassword = await bcrypt.hash('password123', 10);

      // Usar 'email' y 'phone' del estudiante
      const [userResult] = await db.query(
        'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
        [name, email, phone, hashedPassword, 'estudiante']
      );

      userId = userResult.insertId;
      console.log("Usuario creado con ID:", userId);
    }

    // Verificar que user_id no sea nulo
    if (!userId) {
      return res.status(400).json({ message: 'El campo user_id es obligatorio' });
    }
    // Crear el estudiante
    const [result] = await pool.query(
      'INSERT INTO students (user_id, contact_email, contact_phone, age, grade, course_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, contact_email, contact_phone, age, grade, course_id]
    );

    const studentId = result.insertId;
    console.log("Estudiante creado con ID:", studentId);

    // Si se proporcionó un teacher_id, crear la relación
    if (teacher_id) {
      await pool.query(
        'INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)',
        [teacher_id, studentId]
      );
      console.log("Relación con profesor creada");
    }

    // Obtener el estudiante recién creado con toda su información
    const [studentRows] = await pool.query(
      `SELECT s.*, u.name, u.email, u.phone, u.role 
       FROM students s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.id = ?`,
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado después de crearlo' });
    }

    res.status(201).json({ 
      success: true,
      message: 'Estudiante creado exitosamente',
      student: studentRows[0]
    });
  } catch (error) {
    console.error('❌ Error al crear estudiante:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear estudiante',
      error: error.message 
    });
  }
});

// Actualizar un estudiante
router.put('/:id', isTeacherOrAdmin, async (req, res) => {
  const { name, phone, email, contact_email, contact_phone, grade, course_id, age, teacher_id } = req.body;
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
    
    // Actualizar el usuario con sus datos correctos
    await pool.query(
      'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      // CORREGIDO: Se usan 'email' y 'phone' del estudiante
      [name, email, phone, userId]
    );
    
    // Actualizar el estudiante con los datos de contacto
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

// Obtener todos los estudiantes de un profesor específico
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const [rows] = await pool.query(`
      SELECT DISTINCT s.*, u.name, u.email, u.phone, u.role, c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN teacher_students ts ON s.id = ts.student_id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE ts.teacher_id = ?
    `, [teacherId]);
    
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener estudiantes del profesor:', err);
    res.status(500).json({ error: 'Error al obtener estudiantes del profesor' });
  }
});

export default router;
