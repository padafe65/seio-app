import express from 'express';
import pool from '../config/db.js'; // tu conexión MySQL
const router = express.Router();
// Obtener todos los cuestionarios
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM questionnaires');
    res.json(rows);
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

// Obtener cuestionarios según grado y curso del estudiante
router.get('/student/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    // Obtener grado y curso del estudiante
    const [studentRows] = await pool.query(
      'SELECT grade, course FROM students WHERE id = ?',
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const { grade, course } = studentRows[0];

    // Obtener cuestionarios que coincidan con el grado y curso
    const [questionnaires] = await pool.query(
      `SELECT q.*, t.name AS teacher_name, t.subject
       FROM questionnaires q
       JOIN teachers t ON q.teacher_id = t.id
       WHERE q.grade = ? AND q.course = ?`,
      [grade, course]
    );

    res.json(questionnaires);
  } catch (err) {
    console.error('❌ Error al filtrar cuestionarios:', err);
    res.status(500).json({ error: 'Error al obtener los cuestionarios filtrados' });
  }
});


export default router;
