import express from 'express';
import pool from '../config/db.js'; // tu conexión MySQL
const router = express.Router();

// Obtener todos los cuestionarios filtrados por curso del estudiante
router.get('/', async (req, res) => {
  try {
    const { studentId } = req.query;
    
    if (!studentId) {
      const [rows] = await pool.query('SELECT * FROM questionnaires');
      return res.json(rows);
    }
    
    // Obtener el course_id del estudiante
    const [studentRows] = await pool.query(
      'SELECT id, course_id FROM students WHERE user_id = ?',
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.json([]);
    }

    const courseId = studentRows[0].course_id;
    
    // Obtener los cuestionarios del curso del estudiante
    const [rows] = await pool.query(`
      SELECT 
        q.*,
        u.name AS teacher_name,
        c.name AS course_name
      FROM questionnaires q
      JOIN users u ON q.created_by = u.id
      JOIN courses c ON q.course_id = c.id
      WHERE q.course_id = ?
      ORDER BY q.created_at DESC
    `, [courseId]);
    
    // Extraer nombre de materia desde category
    const enrichedRows = rows.map(q => {
      const parts = q.category?.split('_') || [];
      return {
        ...q,
        subject_name: parts[1] || '',
      };
    });
    
    res.json(enrichedRows);
  } catch (err) {
    console.error('❌ Error al obtener cuestionarios:', err);
    res.status(500).json({ error: 'Error al obtener los cuestionarios' });
  }
});

// Obtener un cuestionario por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM questionnaires WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error al obtener cuestionario:', err);
    res.status(500).json({ error: 'Error al obtener el cuestionario' });
  }
});

// Crear un nuevo cuestionario
router.post('/', async (req, res) => {
  const { title, description } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO questionnaires (title, description) VALUES (?, ?)',
      [title, description]
    );
    res.status(201).json({ message: 'Cuestionario creado', id: result.insertId });
  } catch (err) {
    console.error('❌ Error al crear cuestionario:', err);
    res.status(500).json({ error: 'Error al crear el cuestionario' });
  }
});

// Actualizar un cuestionario
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE questionnaires SET title = ?, description = ? WHERE id = ?',
      [title, description, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }
    res.json({ message: 'Cuestionario actualizado' });
  } catch (err) {
    console.error('❌ Error al actualizar cuestionario:', err);
    res.status(500).json({ error: 'Error al actualizar el cuestionario' });
  }
});

// Eliminar un cuestionario
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM questionnaires WHERE id = ?', [id]);
    res.json({ message: 'Cuestionario eliminado' });
  } catch (err) {
    console.error('❌ Error al eliminar cuestionario:', err);
    res.status(500).json({ error: 'Error al eliminar el cuestionario' });
  }
});

// Obtener cuestionarios asignados al curso del estudiante
router.get('/student/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    // Obtener el course_id del estudiante
    const [studentRows] = await pool.query(
      'SELECT course_id FROM students WHERE id = ?',
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const courseId = studentRows[0].course_id;

    // Obtener los cuestionarios asignados a ese curso
    const [questionnaires] = await pool.query(
      `SELECT q.*, t.name AS teacher_name, t.subject
       FROM questionnaires q
       JOIN teachers t ON q.teacher_id = t.id
       WHERE q.course_id = ?`,
      [courseId]
    );

    res.json(questionnaires);
  } catch (err) {
    console.error('❌ Error al obtener cuestionarios por estudiante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// En routes/questionnaires.js o similar
router.get('/by-course/:courseId', async (req, res) => {
  const { courseId } = req.params;
  const [rows] = await pool.query(
    'SELECT id, title FROM questionnaires WHERE course_id = ?',
    [courseId]
  );
  res.json(rows);
});

// Obtener cuestionarios con nombre de curso y docente
router.get('/detailed', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        q.id,
        q.title,
        q.category,
        q.grade,
        q.phase,
        q.created_by,
        q.course_id,
        q.created_at,
        u.name AS teacher_name,
        c.name AS course_name
      FROM questionnaires q
      JOIN users u ON q.created_by = u.id
      JOIN courses c ON q.course_id = c.id
      ORDER BY q.created_at DESC
    `);

    // Extraer nombre de materia desde category si lo necesitas
    const enrichedRows = rows.map(q => {
      const parts = q.category?.split('_') || [];
      return {
        ...q,
        subject_name: parts[1] || '', // Ejemplo: 'Geometría'
      };
    });

    res.json(enrichedRows);
  } catch (err) {
    console.error('❌ Error al obtener cuestionarios detallados:', err);
    res.status(500).json({ error: 'Error al obtener cuestionarios detallados' });
  }
});

export default router;
