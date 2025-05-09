// routes/questionnaireRoutes.js
import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// Obtener todos los cuestionarios
router.get('/', async (req, res) => {
  try {
    const userId = req.query.created_by;
    console.log("ID del usuario recibido:", userId);
    
    if (userId) {
      // Primero obtener el ID del profesor
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [userId]
      );
      
      if (teacherRows.length > 0) {
        const teacherId = teacherRows[0].id;
        
        // Luego obtener los cuestionarios creados por ese profesor
        const query = `
          SELECT 
            q.id, q.title, q.category, q.grade, q.phase, q.created_at, q.course_id, q.created_by,
            u.name as created_by_name,
            c.name as course_name,
            (SELECT COUNT(*) FROM questions WHERE questionnaire_id = q.id) as question_count
          FROM questionnaires q
          JOIN users u ON q.created_by = u.id
          JOIN courses c ON q.course_id = c.id
          WHERE q.created_by = ?
        `;
        
        const [rows] = await pool.query(query, [teacherId]);
        res.json(rows);
      } else {
        res.json([]);
      }
    } else {
      // Si no se proporciona userId, devolver todos los cuestionarios
      const query = `
        SELECT 
          q.id, q.title, q.category, q.grade, q.phase, q.created_at, q.course_id, q.created_by,
          u.name as created_by_name,
          c.name as course_name,
          (SELECT COUNT(*) FROM questions WHERE questionnaire_id = q.id) as question_count
        FROM questionnaires q
        JOIN users u ON q.created_by = u.id
        JOIN courses c ON q.course_id = c.id
      `;
      
      const [rows] = await pool.query(query);
      res.json(rows);
    }
  } catch (error) {
    console.error('❌ Error al obtener cuestionarios:', error);
    res.status(500).json({ message: 'Error al obtener cuestionarios' });
  }
});

// Obtener un cuestionario específico por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        q.id, q.title, q.category, q.grade, q.phase, q.created_at, q.course_id, q.created_by,
        u.name as created_by_name,
        c.name as course_name
      FROM questionnaires q
      JOIN users u ON q.created_by = u.id
      JOIN courses c ON q.course_id = c.id
      WHERE q.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado' });
    }
    
    // Obtener las preguntas asociadas al cuestionario
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ?',
      [id]
    );
    
    res.json({
      questionnaire: rows[0],
      questions
    });
  } catch (error) {
    console.error('❌ Error al obtener cuestionario:', error);
    res.status(500).json({ message: 'Error al obtener cuestionario' });
  }
});

// Crear un nuevo cuestionario
router.post('/', async (req, res) => {
  try {
    const { title, category, grade, phase, course_id, created_by } = req.body;
    
    console.log('Datos recibidos para crear cuestionario:', req.body);
    
    // Validar que todos los campos necesarios estén presentes
    if (!title || !category || !grade || !phase || !course_id || !created_by) {
      return res.status(400).json({ 
        message: 'Faltan campos requeridos', 
        received: { title, category, grade, phase, course_id, created_by } 
      });
    }
    
    // Obtener el ID del profesor si se proporciona el ID de usuario
    let teacherId = created_by;
    
    // Verificar si created_by es un ID de usuario
    if (created_by > 0) {
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [created_by]
      );
      
      if (teacherRows.length > 0) {
        teacherId = teacherRows[0].id;
      }
    }
    
    const [result] = await pool.query(
      `INSERT INTO questionnaires (title, category, grade, phase, course_id, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, category, grade, phase, course_id, teacherId]
    );
    
    res.status(201).json({ 
      message: 'Cuestionario creado correctamente', 
      id: result.insertId 
    });
  } catch (error) {
    console.error('❌ Error al crear cuestionario:', error);
    res.status(500).json({ message: 'Error al crear cuestionario' });
  }
});

// Actualizar un cuestionario existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, grade, phase, course_id } = req.body;
    
    const [result] = await pool.query(
      `UPDATE questionnaires 
       SET title = ?, category = ?, grade = ?, phase = ?, course_id = ? 
       WHERE id = ?`,
      [title, category, grade, phase, course_id, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado' });
    }
    
    res.json({ message: 'Cuestionario actualizado correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar cuestionario:', error);
    res.status(500).json({ message: 'Error al actualizar cuestionario' });
  }
});

// Eliminar un cuestionario
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Primero eliminar las preguntas asociadas
    await pool.query('DELETE FROM questions WHERE questionnaire_id = ?', [id]);
    
    // Luego eliminar el cuestionario
    const [result] = await pool.query('DELETE FROM questionnaires WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado' });
    }
    
    res.json({ message: 'Cuestionario y sus preguntas eliminados correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar cuestionario:', error);
    res.status(500).json({ message: 'Error al eliminar cuestionario' });
  }
});

export default router;
