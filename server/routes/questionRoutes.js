// backend/routes/questionRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Helper para verificar si un docente es propietario de un cuestionario
const checkOwnership = async (questionnaireId, userId) => {
  const [teacherRows] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [userId]);
  if (teacherRows.length === 0) return false; // No es un profesor
  const teacherId = teacherRows[0].id;

  const [qRows] = await pool.query('SELECT id FROM questionnaires WHERE id = ? AND created_by = ?', [questionnaireId, teacherId]);
  return qRows.length > 0;
};

// Crear nueva pregunta
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  try {
    let { questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category } = req.body;

    if (req.user.role === 'docente') {
      const isOwner = await checkOwnership(questionnaire_id, req.user.id);
      if (!isOwner) {
        return res.status(403).json({ message: 'Acceso denegado: no puedes añadir preguntas a un cuestionario que no te pertenece.' });
      }
    }

    if (!category) {
      const [qRows] = await pool.query('SELECT category FROM questionnaires WHERE id = ?', [questionnaire_id]);
      category = qRows.length > 0 ? qRows[0].category : null;
    }

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await pool.query(
      `INSERT INTO questions (questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category, image_url]
    );
    res.status(201).json({ message: 'Pregunta creada', id: result.insertId });
  } catch (error) {
    console.error('❌ Error al crear pregunta:', error);
    res.status(500).json({ message: 'Error al crear la pregunta' });
  }
});

// Obtener todas las preguntas (filtrado por rol)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { questionnaire_id } = req.query;
    let query = 'SELECT q.* FROM questions q';
    const params = [];

    if (req.user.role === 'docente') {
      const [teacherRows] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      if (teacherRows.length === 0) return res.json([]);
      const teacherId = teacherRows[0].id;

      query += ' JOIN questionnaires qn ON q.questionnaire_id = qn.id WHERE qn.created_by = ?';
      params.push(teacherId);

      if (questionnaire_id) {
        query += ' AND q.questionnaire_id = ?';
        params.push(questionnaire_id);
      }
    } else if (questionnaire_id) {
      query += ' WHERE q.questionnaire_id = ?';
      params.push(questionnaire_id);
    }
    
    query += ' ORDER BY q.id DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener preguntas:', error);
    res.status(500).json({ message: 'Error al obtener preguntas' });
  }
});

// Obtener una pregunta específica por ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM questions WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Pregunta no encontrada' });

    if (req.user.role === 'docente') {
      const isOwner = await checkOwnership(rows[0].questionnaire_id, req.user.id);
      if (!isOwner) return res.status(403).json({ message: 'Acceso denegado.' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener pregunta:', error);
    res.status(500).json({ message: 'Error al obtener pregunta' });
  }
});

// Actualizar una pregunta existente
router.put('/:id', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category } = req.body;

    const [qRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [id]);
    if (qRows.length === 0) return res.status(404).json({ message: 'Pregunta no encontrada.' });

    if (req.user.role === 'docente') {
      const isOwner = await checkOwnership(qRows[0].questionnaire_id, req.user.id);
      if (!isOwner) return res.status(403).json({ message: 'Acceso denegado.' });
    }

    const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || qRows[0].image_url);

    await pool.query(
      `UPDATE questions SET questionnaire_id = ?, question_text = ?, option1 = ?, option2 = ?, option3 = ?, option4 = ?, correct_answer = ?, category = ?, image_url = ? WHERE id = ?`,
      [questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category, image_url, id]
    );
    res.json({ message: 'Pregunta actualizada' });
  } catch (error) {
    console.error('❌ Error al actualizar la pregunta:', error);
    res.status(500).json({ message: 'Error al actualizar la pregunta' });
  }
});

// Eliminar una pregunta
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [qRows] = await pool.query('SELECT questionnaire_id FROM questions WHERE id = ?', [id]);
    if (qRows.length === 0) return res.status(404).json({ message: 'Pregunta no encontrada.' });

    if (req.user.role === 'docente') {
      const isOwner = await checkOwnership(qRows[0].questionnaire_id, req.user.id);
      if (!isOwner) return res.status(403).json({ message: 'Acceso denegado.' });
    }

    await pool.query('DELETE FROM questions WHERE id = ?', [id]);
    res.json({ message: 'Pregunta eliminada' });
  } catch (error) {
    console.error('❌ Error al eliminar pregunta:', error);
    res.status(500).json({ message: 'Error al eliminar la pregunta' });
  }
});

export default router;
