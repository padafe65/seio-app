// backend/routes/questionRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../config/db.js';

const router = express.Router();

// Configuración de Multer para subir imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Carpeta donde se guardan las imágenes
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nombre único
  }
});
const upload = multer({ storage });

// ✅ Crear nueva pregunta
router.post('/questions', upload.single('image'), async (req, res) => {
  try {
    const {
      questionnaire_id,
      question_text,
      option1,
      option2,
      option3,
      option4,
      correct_answer,
      category
    } = req.body;

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

// ✅ Obtener todas las preguntas
router.get('/questions', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM questions');
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener preguntas:', error);
    res.status(500).json({ message: 'Error al obtener preguntas' });
  }
});

// ✅ Eliminar una pregunta
router.delete('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM questions WHERE id = ?', [id]);
    res.json({ message: 'Pregunta eliminada' });
  } catch (error) {
    console.error('❌ Error al eliminar pregunta:', error);
    res.status(500).json({ message: 'Error al eliminar la pregunta' });
  }
});

// ✅ Actualizar una pregunta
// ✅ Actualizar una pregunta existente
router.put('/questions/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;

    const {
      questionnaire_id,
      question_text,
      option1,
      option2,
      option3,
      option4,
      correct_answer,
      category
    } = req.body;

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const fields = [
      'questionnaire_id = ?',
      'question_text = ?',
      'option1 = ?',
      'option2 = ?',
      'option3 = ?',
      'option4 = ?',
      'correct_answer = ?',
      'category = ?',
    ];

    const values = [
      questionnaire_id,
      question_text,
      option1,
      option2,
      option3,
      option4,
      correct_answer,
      category
    ];

    if (image_url) {
      fields.push('image_url = ?');
      values.push(image_url);
    }

    values.push(id); // Para la cláusula WHERE

    const sql = `UPDATE questions SET ${fields.join(', ')} WHERE id = ?`;

    const [result] = await pool.query(sql, values);

    res.json({ message: 'Pregunta actualizada', affectedRows: result.affectedRows });
  } catch (error) {
    console.error('❌ Error al actualizar la pregunta:', error);
    res.status(500).json({ message: 'Error al actualizar la pregunta' });
  }
});



export default router;
