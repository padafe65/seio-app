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
      category,
      is_prueba_saber,
      prueba_saber_level
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

    // Validar nivel de Prueba Saber si es tipo Prueba Saber
    let finalPruebaSaberLevel = null;
    if (is_prueba_saber === 'true' || is_prueba_saber === true) {
      const validLevels = [3, 5, 9, 11];
      const level = parseInt(prueba_saber_level);
      if (!validLevels.includes(level)) {
        return res.status(400).json({
          success: false,
          message: 'El nivel de Prueba Saber debe ser 3, 5, 9 o 11'
        });
      }
      finalPruebaSaberLevel = level;
    }

    const [result] = await pool.query(
      `INSERT INTO questions 
       (questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category, image_url, is_prueba_saber, prueba_saber_level) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        questionnaire_id, 
        question_text, 
        option1, 
        option2, 
        option3, 
        option4, 
        correct_answer, 
        finalCategory, 
        image_url,
        is_prueba_saber === 'true' || is_prueba_saber === true ? 1 : 0,
        finalPruebaSaberLevel
      ]
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

/**
 * GET /api/questions/prueba-saber
 * Obtener preguntas tipo Prueba Saber filtradas por docente, institución y nivel
 * Roles: docente (solo sus preguntas), administrador y super_administrador (todas)
 */
router.get('/prueba-saber', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { level, institution_id } = req.query;
    const userRole = req.user.role;
    
    let query = `
      SELECT 
        q.*,
        qn.title as questionnaire_title,
        qn.subject as questionnaire_subject,
        qn.grade as questionnaire_grade,
        t.id as teacher_id,
        u.name as teacher_name,
        u.institution as teacher_institution
      FROM questions q
      LEFT JOIN questionnaires qn ON q.questionnaire_id = qn.id
      LEFT JOIN teachers t ON qn.created_by = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE q.is_prueba_saber = 1
    `;
    
    const params = [];
    
    // Si es docente, solo mostrar sus preguntas
    if (userRole === 'docente') {
      const [teachers] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teachers.length === 0) {
        return res.json({ success: true, data: [] });
      }
      
      query += ` AND qn.created_by = ?`;
      params.push(teachers[0].id);
    }
    
    // Filtrar por nivel si se especifica
    if (level) {
      const levelInt = parseInt(level);
      if ([3, 5, 9, 11].includes(levelInt)) {
        query += ` AND q.prueba_saber_level = ?`;
        params.push(levelInt);
      }
    }
    
    // Filtrar por institución si se especifica (solo para admin/super_admin)
    if ((userRole === 'administrador' || userRole === 'super_administrador') && institution_id) {
      query += ` AND u.institution = ?`;
      params.push(institution_id);
    } else if (userRole === 'docente') {
      // Para docentes, filtrar automáticamente por su institución
      const [userInfo] = await connection.query(
        'SELECT institution FROM users WHERE id = ?',
        [req.user.id]
      );
      
      if (userInfo.length > 0 && userInfo[0].institution) {
        query += ` AND u.institution = ?`;
        params.push(userInfo[0].institution);
      }
    }
    
    query += ` ORDER BY q.prueba_saber_level ASC, q.id DESC`;
    
    const [questions] = await connection.query(query, params);
    
    res.json({
      success: true,
      count: questions.length,
      data: questions
    });
    
  } catch (error) {
    console.error('❌ Error al obtener preguntas Prueba Saber:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener preguntas Prueba Saber',
      error: error.message
    });
  } finally {
    connection.release();
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


// ✅ Actualizar una pregunta existente
router.put('/:id', verifyToken, isTeacherOrAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.id;
    
    // Verificar si la pregunta existe
    const [existingQuestion] = await pool.query('SELECT * FROM questions WHERE id = ?', [id]);
    if (existingQuestion.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pregunta no encontrada' 
      });
    }

    // Verificar que el cuestionario de la pregunta pertenece al docente autenticado
    const [questionnaireCheck] = await pool.query(`
      SELECT q.created_by, t.user_id 
      FROM questionnaires q 
      JOIN teachers t ON q.created_by = t.id 
      WHERE q.id = ?
    `, [existingQuestion[0].questionnaire_id]);
    
    if (questionnaireCheck.length === 0 || questionnaireCheck[0].user_id !== requestingUserId) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permisos para editar esta pregunta' 
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
      category,
      is_prueba_saber,
      prueba_saber_level
    } = req.body;

    // Verificar que el nuevo cuestionario también pertenece al docente
    if (questionnaire_id && questionnaire_id !== existingQuestion[0].questionnaire_id) {
      const [newQuestionnaireCheck] = await pool.query(`
        SELECT q.created_by, t.user_id 
        FROM questionnaires q 
        JOIN teachers t ON q.created_by = t.id 
        WHERE q.id = ?
      `, [questionnaire_id]);
      
      if (newQuestionnaireCheck.length === 0 || newQuestionnaireCheck[0].user_id !== requestingUserId) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permisos para asignar esta pregunta al cuestionario seleccionado' 
        });
      }
    }

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Validar nivel de Prueba Saber si es tipo Prueba Saber
    let finalPruebaSaberLevel = null;
    if (is_prueba_saber === 'true' || is_prueba_saber === true) {
      const validLevels = [3, 5, 9, 11];
      const level = parseInt(prueba_saber_level);
      if (!validLevels.includes(level)) {
        return res.status(400).json({
          success: false,
          message: 'El nivel de Prueba Saber debe ser 3, 5, 9 o 11'
        });
      }
      finalPruebaSaberLevel = level;
    }

    const fields = [
      'question_text = ?',
      'option1 = ?',
      'option2 = ?',
      'option3 = ?',
      'option4 = ?',
      'correct_answer = ?',
      'category = ?',
      'is_prueba_saber = ?',
      'prueba_saber_level = ?'
    ];

    const values = [
      question_text,
      option1,
      option2,
      option3,
      option4,
      correct_answer,
      category,
      is_prueba_saber === 'true' || is_prueba_saber === true ? 1 : 0,
      finalPruebaSaberLevel
    ];

    // Si hay una nueva imagen, actualizarla
    if (image_url) {
      fields.push('image_url = ?');
      values.push(image_url);
    }

    // Si se cambió el cuestionario, actualizarlo
    if (questionnaire_id) {
      fields.push('questionnaire_id = ?');
      values.push(questionnaire_id);
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
