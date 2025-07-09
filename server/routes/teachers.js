// routes/teachers.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware para verificar el rol de docente o superadmin
const isTeacherOrAdmin = (req, res, next) => {
    if (req.user.role !== 'docente' && req.user.role !== 'super_administrador') {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de Docente o Super Administrador.' });
    }
    next();
};

// Aplicar middleware de verificación de token a todas las rutas
router.use(verifyToken);

// Obtener todos los profesores con sus datos de usuario (solo admin)
router.get('/', isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.*, u.name, u.email, u.phone, u.role 
      FROM teachers t
      JOIN users u ON t.user_id = u.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener profesores:', error);
    res.status(500).json({ message: 'Error al obtener profesores' });
  }
});

// Obtener un profesor por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(
      `SELECT t.*, u.name, u.email, u.phone, u.role 
       FROM teachers t
       JOIN users u ON t.user_id = u.id 
       WHERE t.id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error al obtener profesor:', error);
    res.status(500).json({ message: 'Error al obtener profesor' });
  }
});

// Crear un nuevo profesor
router.post('/', isAdmin, async (req, res) => {
  try {
    const { user_id, subject, institution } = req.body;
    
    // Verificar si el usuario ya es profesor
    const [existingTeacher] = await pool.query(
      'SELECT * FROM teachers WHERE user_id = ?',
      [user_id]
    );
    
    if (existingTeacher.length > 0) {
      return res.status(400).json({ message: 'Este usuario ya está registrado como profesor' });
    }
    
    // Crear el profesor
    const [result] = await pool.query(
      'INSERT INTO teachers (user_id, subject, institution) VALUES (?, ?, ?)',
      [user_id, subject, institution]
    );
    
    // Actualizar el rol del usuario a 'docente' si no lo es ya
    await pool.query(
      "UPDATE users SET role = 'docente' WHERE id = ? AND role != 'super_administrador'",
      [user_id]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Profesor registrado correctamente',
      teacherId: result.insertId 
    });
  } catch (error) {
    console.error('❌ Error al crear profesor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear profesor',
      error: error.message 
    });
  }
});

// Actualizar un profesor
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, institution } = req.body;
    
    const [result] = await pool.query(
      'UPDATE teachers SET subject = ?, institution = ? WHERE id = ?',
      [subject, institution, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    res.json({ 
      success: true, 
      message: 'Profesor actualizado correctamente' 
    });
  } catch (error) {
    console.error('❌ Error al actualizar profesor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar profesor',
      error: error.message 
    });
  }
});

// Eliminar un profesor
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener el user_id del profesor
    const [teacherRows] = await pool.query(
      'SELECT user_id FROM teachers WHERE id = ?',
      [id]
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    const userId = teacherRows[0].user_id;
    
    // Iniciar transacción
    await pool.query('START TRANSACTION');
    
    try {
      // Eliminar relaciones del profesor con estudiantes
      await pool.query('DELETE FROM teacher_students WHERE teacher_id = ?', [id]);
      
      // Eliminar al profesor
      await pool.query('DELETE FROM teachers WHERE id = ?', [id]);
      
      // Si el usuario no es super_administrador, cambiar su rol a 'estudiante'
      await pool.query(
        "UPDATE users SET role = 'estudiante' WHERE id = ? AND role != 'super_administrador'",
        [userId]
      );
      
      // Confirmar transacción
      await pool.query('COMMIT');
      
      res.json({ 
        success: true, 
        message: 'Profesor eliminado correctamente' 
      });
    } catch (error) {
      // Revertir transacción en caso de error
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Error al eliminar profesor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar profesor',
      error: error.message 
    });
  }
});

// Obtener estudiantes de un profesor
router.get('/:id/students', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(`
      SELECT s.*, u.name, u.email, u.phone, u.role,
             c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      JOIN teacher_students ts ON s.id = ts.student_id
      WHERE ts.teacher_id = ?
    `, [id]);
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener estudiantes del profesor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estudiantes del profesor',
      error: error.message 
    });
  }
});

// Obtener lista de profesores con sus nombres
router.get('/list/all', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.id, t.subject, u.name 
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      ORDER BY u.name
    `);
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener lista de profesores:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener lista de profesores',
      error: error.message 
    });
  }
});

export default router;
