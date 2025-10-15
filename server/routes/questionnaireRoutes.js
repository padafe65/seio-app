// routes/questionnaireRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { ensureSubjectCategoryExists } from '../utils/syncSubjectCategories.js';

const router = express.Router();

// Obtener todos los cuestionarios
router.get('/', async (req, res) => {
  try {
    const { created_by, phase, grade, studentId, description } = req.query;
    let params = [];
    let conditions = [];
    let query = `
      SELECT 
        q.id, q.title, q.subject, q.category, q.grade, q.phase, q.created_at, q.course_id, q.created_by, q.description,
        u.name as created_by_name,
        c.name as course_name,
        (SELECT COUNT(*) FROM questions WHERE questionnaire_id = q.id) as question_count
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users u ON t.user_id = u.id
      JOIN courses c ON q.course_id = c.id
    `;
    
    // Si hay un studentId, filtrar por el grado del estudiante
    if (studentId) {
      // Obtener el grado y course_id del estudiante
      const [studentRows] = await pool.query(
        'SELECT grade, course_id FROM students WHERE user_id = ?',
        [studentId]
      );

      if (studentRows.length > 0) {
        const studentGrade = studentRows[0].grade;
        
        // Filtrar cuestionarios por el grado del estudiante
        conditions.push('q.grade = ?');
        params.push(studentGrade);
      } else {
        // Si no se encuentra el estudiante, devolver un array vacío
        return res.json([]);
      }
    }
    
    if (created_by) {
      // Obtener el ID del profesor a partir del ID de usuario
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [created_by]
      );
      
      if (teacherRows.length > 0) {
        const teacherId = teacherRows[0].id;
        conditions.push('q.created_by = ?');
        params.push(teacherId);
      }
    }
    
    if (phase) {
      conditions.push('q.phase = ?');
      params.push(phase);
    }
    
    if (grade) {
      conditions.push('q.grade = ?');
      params.push(grade);
    }

    if (description) {
      conditions.push('q.description = ?');
      params.push(grade);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY q.created_at DESC';
    
    const [rows] = await pool.query(query, params);
    
    // Enriquecer los resultados con el nombre de la materia
    const enrichedRows = rows.map(q => {
      const parts = q.category?.split('_') || [];
      return {
        ...q,
        subject_name: parts[1] || '',
      };
    });
    
    res.json(enrichedRows);
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
        q.id, q.title, q.subject, q.category, q.grade, q.phase, q.created_at, q.course_id, q.created_by, q.description,
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
    
    const questionnaire = rows[0];
    
    // Asegurar que la combinación subject-category existe en subject_categories
    await ensureSubjectCategoryExists(questionnaire.subject, questionnaire.category);
    
    // Obtener las preguntas asociadas al cuestionario
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ?',
      [id]
    );
    
    res.json({
      questionnaire,
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
    const { title, subject, category, grade, phase, course_id, created_by, description } = req.body;
    
    console.log('Datos recibidos para crear cuestionario:', req.body);
    
    // Validar que todos los campos necesarios estén presentes
    if (!title || !grade || !phase || !course_id || !created_by || !description) {
      console.log('Faltan campos requeridos:', { title, subject, category, grade, phase, course_id, created_by, description });
      return res.status(400).json({ 
        message: 'Faltan campos requeridos', 
        received: { title, subject, category, grade, phase, course_id, created_by, description } 
      });
    }
    
    // Obtener el ID del profesor si se proporciona el ID de usuario (users.id = teachers.user_id)
    let teacherId = created_by;
    
    // Verificar si created_by es un ID de usuario
    if (created_by > 0) {
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [created_by]
      );
      
      if (teacherRows.length > 0) {
        teacherId = teacherRows[0].id; // teachers.id = questionnaires.created_by
      }
    }
    
    // Asegurar que la combinación subject-category existe en subject_categories
    await ensureSubjectCategoryExists(subject, category);
    
    const [result] = await pool.query(
      `INSERT INTO questionnaires (title, subject, category, grade, phase, course_id, created_by, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, subject || null, category || null, grade, phase, course_id, teacherId, description]
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
    const { title, subject, category, grade, phase, course_id, description } = req.body;
    
    // Asegurar que la combinación subject-category existe en subject_categories
    await ensureSubjectCategoryExists(subject, category);
    
    const [result] = await pool.query(
      `UPDATE questionnaires 
       SET title = ?, subject = ?, category = ?, grade = ?, phase = ?, course_id = ?, description = ? 
       WHERE id = ?`,
      [title, subject || null, category || null, grade, phase, course_id, description, id]
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
