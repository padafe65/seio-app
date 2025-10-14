// backend/routes/questionRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../config/db.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';

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

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});

// Obtener todas las preguntas de un cuestionario
router.get('/questions/:questionnaireId', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ?',
      [questionnaireId]
    );
    
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error('Error al obtener preguntas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener las preguntas' });
  }
});

// Obtener una pregunta por ID
router.get('/question/:id', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE id = ?',
      [id]
    );
    
    if (questions.length === 0) {
      return res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
    }
    
    res.json({ success: true, data: questions[0] });
  } catch (error) {
    console.error('Error al obtener la pregunta:', error);
    res.status(500).json({ success: false, message: 'Error al obtener la pregunta' });
  }
});

// Crear nueva pregunta
router.post('/question', verifyToken, isTeacherOrAdmin, upload.single('image'), async (req, res) => {
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

    // Si no se proporciona una categoría, obtenerla del cuestionario
    let finalCategory = category;
    if (!finalCategory) {
      const [questionnaireRows] = await pool.query(
        'SELECT category FROM questionnaires WHERE id = ?',
        [questionnaire_id]
      );
      
      if (questionnaireRows.length > 0) {
        finalCategory = questionnaireRows[0].category;
      } else {
        return res.status(400).json({ 
          success: false,
          message: 'No se pudo determinar la categoría del cuestionario' 
        });
      }
    }

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO questions 
       (questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category, image_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, finalCategory, image_url]
    );

    res.status(201).json({
      success: true,
      message: 'Pregunta creada exitosamente',
      data: {
        id: result.insertId,
        questionnaire_id,
        question_text,
        category: finalCategory
      }
    });
  } catch (error) {
    console.error('Error al crear la pregunta:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear la pregunta',
      error: error.message
    });
  }
});

// Obtener todas las preguntas
router.get('/questions', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM questions');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al obtener preguntas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener preguntas' });
  }
});

// Eliminar una pregunta
router.delete('/questions/:id', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si la pregunta existe
    const [existingQuestion] = await pool.query('SELECT * FROM questions WHERE id = ?', [id]);
    
    if (existingQuestion.length === 0) {
      return res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
    }

    await pool.query('DELETE FROM questions WHERE id = ?', [id]);
    
    res.json({ 
      success: true,
      message: 'Pregunta eliminada exitosamente' 
    });
  } catch (error) {
    console.error('Error al eliminar pregunta:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar la pregunta' 
    });
  }
});

// Obtener una pregunta específica por ID
router.get('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Intentando obtener pregunta con ID: ${id}`);
    
    // Consulta simplificada para evitar problemas con los JOIN
    const [rows] = await pool.query(
      `SELECT * FROM questions WHERE id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Pregunta no encontrada' });
    }
    
    // Si la pregunta tiene un questionnaire_id, obtener el título del cuestionario
    if (rows[0].questionnaire_id) {
      const [questionnaires] = await pool.query(
        `SELECT title FROM questionnaires WHERE id = ?`,
        [rows[0].questionnaire_id]
      );
      
      if (questionnaires.length > 0) {
        rows[0].questionnaire_title = questionnaires[0].title;
      }
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener pregunta:', error);
    res.status(500).json({ message: 'Error al obtener pregunta', error: error.message });
  }
});


// ✅ Actualizar una pregunta
// ✅ Actualizar una pregunta existente
// ✅ Actualizar una pregunta existente
router.put('/:id', verifyToken, isTeacherOrAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si la pregunta existe
    const [existingQuestion] = await pool.query('SELECT * FROM questions WHERE id = ?', [id]);
    if (existingQuestion.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pregunta no encontrada' 
      });
    }

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
      'question_text = ?',
      'option1 = ?',
      'option2 = ?',
      'option3 = ?',
      'option4 = ?',
      'correct_answer = ?',
      'category = ?'
    ];

    const values = [
      question_text,
      option1,
      option2,
      option3,
      option4,
      correct_answer,
      category
    ];

    // Si hay una nueva imagen, actualizarla
    if (image_url) {
      fields.push('image_url = ?');
      values.push(image_url);
    }

    values.push(id); // Para la cláusula WHERE

    const sql = `UPDATE questions SET ${fields.join(', ')} WHERE id = ?`;

    const [result] = await pool.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No se encontró la pregunta para actualizar' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Pregunta actualizada exitosamente',
      data: { id: req.params.id }
    });
  } catch (error) {
    console.error('Error al actualizar la pregunta:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar la pregunta',
      error: error.message 
    });
  }
});

export default router;
