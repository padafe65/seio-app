// routes/indicatorRoutes.js
import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// Obtener todos los indicadores (con filtros opcionales)
router.get('/', async (req, res) => {
  try {
    const { teacher_id, student_id, subject, phase } = req.query;
    
    let query = `
      SELECT i.*, t.subject as teacher_subject, u.name as teacher_name
      FROM indicators i
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (teacher_id) {
      query += ' AND i.teacher_id = ?';
      params.push(teacher_id);
    }
    
    if (student_id) {
      query += ' AND (i.student_id = ? OR i.student_id IS NULL)';
      params.push(student_id);
    }
    
    if (subject) {
      query += ' AND i.subject = ?';
      params.push(subject);
    }
    
    if (phase) {
      query += ' AND i.phase = ?';
      params.push(phase);
    }
    
    query += ' ORDER BY i.phase, i.created_at DESC';
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener indicadores:', error);
    res.status(500).json({ message: 'Error al obtener indicadores' });
  }
});

// Obtener un indicador específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(`
      SELECT i.*, t.subject as teacher_subject, u.name as teacher_name
      FROM indicators i
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE i.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Indicador no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error al obtener indicador:', error);
    res.status(500).json({ message: 'Error al obtener indicador' });
  }
});

// Crear un nuevo indicador
router.post('/', async (req, res) => {
  try {
    const { teacher_id, student_id, description, subject, phase, achieved, questionnaire_id, grade } = req.body;
    
    const [result] = await pool.query(`
      INSERT INTO indicators 
      (teacher_id, student_id, description, subject, phase, achieved, questionnaire_id, grade) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [teacher_id, student_id || null, description, subject, phase, achieved || 0, questionnaire_id || null, grade || null]);
    
    res.status(201).json({
      id: result.insertId,
      message: 'Indicador creado correctamente'
    });
  } catch (error) {
    console.error('❌ Error al crear indicador:', error);
    res.status(500).json({ message: 'Error al crear indicador' });
  }
});


// Actualizar un indicador existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { description, subject, phase, achieved, questionnaire_id, grade } = req.body;
    // Eliminar esta línea: alert(grade);
    console.log("Grade recibido:", grade);
    
    await pool.query(`
      UPDATE indicators 
      SET description = ?, subject = ?, phase = ?, achieved = ?, questionnaire_id = ?, grade = ?
      WHERE id = ?
    `, [description, subject, phase, achieved, questionnaire_id, grade || null, id]);
    
    res.json({ message: 'Indicador actualizado correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar indicador:', error);
    res.status(500).json({ message: 'Error al actualizar indicador' });
  }
});


// Eliminar un indicador
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM indicators WHERE id = ?', [id]);
    
    res.json({ message: 'Indicador eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar indicador:', error);
    res.status(500).json({ message: 'Error al eliminar indicador' });
  }
});

// Obtener cuestionarios para el combo box - MODIFICADO para usar user_id en lugar de teacher_id
router.get('/questionnaires/teacher/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Buscando cuestionarios para el usuario ID:", userId);
    
    // Primero obtener el ID del profesor a partir del ID de usuario
    const [teacherRows] = await pool.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    const teacherId = teacherRows[0].id;
    console.log("ID del profesor encontrado:", teacherId);
    
    // Ahora obtener los cuestionarios usando el ID correcto del profesor
    const [rows] = await pool.query(`
      SELECT q.id, q.title, q.grade, q.phase, q.category, q.created_by, q.course_id
      FROM questionnaires q
      WHERE q.created_by = ?
      ORDER BY q.created_at DESC
    `, [teacherId]);
    
    console.log("Cuestionarios encontrados:", rows.length);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error detallado al obtener cuestionarios:', error.message, error.stack);
    res.status(500).json({ message: 'Error al obtener cuestionarios', error: error.message });
  }
});

// Obtener indicadores para un estudiante específico
// Obtener indicadores para un estudiante específico
router.get('/student/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Obtener el ID y grado del estudiante
    const [studentRows] = await pool.query(
      'SELECT id, grade FROM students WHERE user_id = ?',
      [userId]
    );
    
    if (studentRows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    const studentId = studentRows[0].id;
    const studentGrade = studentRows[0].grade;
    
    // Obtener indicadores para el estudiante con filtrado mejorado
    const [rows] = await pool.query(`
      SELECT i.*, u.name as teacher_name,
             q.title as questionnaire_title, q.grade as questionnaire_grade, 
             q.phase as questionnaire_phase
      FROM indicators i
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN questionnaires q ON i.questionnaire_id = q.id
      WHERE (
        i.student_id = ? 
        OR (i.student_id IS NULL AND (i.grade = ? OR i.grade IS NULL))
      )
      ORDER BY i.phase, i.created_at DESC
    `, [studentId, studentGrade]);
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener indicadores del estudiante:', error);
    res.status(500).json({ message: 'Error al obtener indicadores del estudiante' });
  }
});


// Añade esta ruta a tu archivo indicatorRoutes.js
router.get('/subjects/teacher/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Obtener el ID del profesor a partir del ID de usuario
    const [teacherRows] = await pool.query(
      'SELECT id, subject FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    res.json({ subject: teacherRows[0].subject });
  } catch (error) {
    console.error('❌ Error al obtener materia del profesor:', error);
    res.status(500).json({ message: 'Error al obtener materia del profesor' });
  }
});


export default router;
