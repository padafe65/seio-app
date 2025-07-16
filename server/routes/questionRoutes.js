// backend/routes/questionRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../config/db.js';
import { 
  verifyToken, 
  isTeacherOrAdmin,
  isAdmin 
} from '../middleware/authMiddleware.js';

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

// Helper para verificar si un docente es propietario de un cuestionario o pregunta
const checkOwnership = async (resourceId, userId, resourceType = 'question') => {
  try {
    // Obtener el ID del profesor asociado al usuario
    const [teacherRows] = await pool.query(
      'SELECT id FROM teachers WHERE user_id = ?', 
      [userId]
    );
    
    if (teacherRows.length === 0) return false; // No es un profesor
    
    const teacherId = teacherRows[0].id;
    
    if (resourceType === 'question') {
      // Para preguntas, primero obtenemos el cuestionario
      const [questionRows] = await pool.query(
        'SELECT questionnaire_id FROM questions WHERE id = ?',
        [resourceId]
      );
      
      if (questionRows.length === 0) return false;
      
      // Luego verificamos si el cuestionario pertenece al profesor
      const [qRows] = await pool.query(
        'SELECT id FROM questionnaires WHERE id = ? AND created_by = ?',
        [questionRows[0].questionnaire_id, teacherId]
      );
      
      return qRows.length > 0;
    } else {
      // Para cuestionarios, verificamos directamente
      const [qRows] = await pool.query(
        'SELECT id FROM questionnaires WHERE id = ? AND created_by = ?',
        [resourceId, teacherId]
      );
      
      return qRows.length > 0;
    }
  } catch (error) {
    console.error('Error en checkOwnership:', error);
    return false;
  }
};

// Crear nueva pregunta
router.post('/', verifyToken, isTeacherOrAdmin, upload.single('image'), async (req, res) => {
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

    // Validar campos requeridos
    if (!questionnaire_id || !question_text || !option1 || !option2 || !correct_answer) {
      return res.status(400).json({
        message: 'Faltan campos requeridos',
        error: 'VALIDATION_ERROR',
        fields: {
          questionnaire_id: !questionnaire_id ? 'El ID del cuestionario es requerido' : undefined,
          question_text: !question_text ? 'El texto de la pregunta es requerido' : undefined,
          option1: !option1 ? 'La opción 1 es requerida' : undefined,
          option2: !option2 ? 'La opción 2 es requerida' : undefined,
          correct_answer: !correct_answer ? 'La respuesta correcta es requerida' : undefined
        }
      });
    }

    // Verificar permisos
    if (req.user.role === 'docente') {
      const isOwner = await checkOwnership(questionnaire_id, req.user.id, req.user.teacher_id);
      if (!isOwner) {
        return res.status(403).json({ 
          message: 'Acceso denegado: no puedes añadir preguntas a un cuestionario que no te pertenece.',
          error: 'FORBIDDEN'
        });
      }
    }

    // Obtener categoría del cuestionario si no se proporciona
    let finalCategory = category;
    if (!finalCategory) {
      const [qRows] = await pool.query(
        'SELECT category FROM questionnaires WHERE id = ?', 
        [questionnaire_id]
      );
      finalCategory = qRows.length > 0 ? qRows[0].category : null;
    }

    // Manejar la imagen si se subió
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Insertar la nueva pregunta
    const [result] = await pool.query(
      `INSERT INTO questions 
       (questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        questionnaire_id, 
        question_text, 
        option1, 
        option2, 
        option3 || null, 
        option4 || null, 
        correct_answer, 
        finalCategory, 
        image_url
      ]
    );

    // Obtener la pregunta recién creada
    const [newQuestion] = await pool.query(
      'SELECT * FROM questions WHERE id = ?',
      [result.insertId]
    );
    
    if (!newQuestion || newQuestion.length === 0) {
      throw new Error('No se pudo recuperar la pregunta recién creada');
    }
    
    // Formatear la respuesta
    const response = {
      ...newQuestion[0],
      options: [
        { id: 1, text: newQuestion[0].option1 },
        { id: 2, text: newQuestion[0].option2 },
        { id: 3, text: newQuestion[0].option3 || '' },
        { id: 4, text: newQuestion[0].option4 || '' }
      ],
      correct_option: parseInt(newQuestion[0].correct_answer)
    };
    
    res.status(201).json({
      message: 'Pregunta creada correctamente',
      data: response
    });
  } catch (error) {
    console.error('❌ Error al crear pregunta:', error);
    
    // Manejar errores de duplicados
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Ya existe una pregunta idéntica en este cuestionario',
        error: 'DUPLICATE_ENTRY'
      });
    }
    
    res.status(500).json({ 
      message: 'Error al crear la pregunta',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtener todas las preguntas (filtrado por rol)
router.get('/', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { questionnaire_id } = req.query;
    let query = `
      SELECT q.*, qn.title as questionnaire_title, u.name as created_by_name
      FROM questions q
      JOIN questionnaires qn ON q.questionnaire_id = qn.id
      JOIN teachers t ON qn.created_by = t.id
      JOIN users u ON t.user_id = u.id
    `;
    
    const params = [];
    const conditions = [];

    // Si es docente, solo puede ver sus propias preguntas
    if (req.user.role === 'docente' && req.user.teacher_id) {
      conditions.push('qn.created_by = ?');
      params.push(req.user.teacher_id);
    }

    // Filtrar por cuestionario si se especifica
    if (questionnaire_id) {
      conditions.push('q.questionnaire_id = ?');
      params.push(questionnaire_id);
      
      // Verificar permisos adicionales para el cuestionario específico
      if (req.user.role === 'docente') {
        const isOwner = await checkOwnership(questionnaire_id, req.user.id, req.user.teacher_id);
        if (!isOwner) {
          return res.status(403).json({ 
            message: 'No tienes permiso para ver las preguntas de este cuestionario' 
          });
        }
      }
    }

    // Aplicar condiciones WHERE si existen
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Ordenar por ID descendente
    query += ' ORDER BY q.id DESC';
    
    // Ejecutar consulta
    const [rows] = await pool.query(query, params);
    
    // Formatear la respuesta
    const formattedRows = rows.map(row => ({
      ...row,
      options: [
        { id: 1, text: row.option1 },
        { id: 2, text: row.option2 },
        { id: 3, text: row.option3 },
        { id: 4, text: row.option4 }
      ],
      correct_option: parseInt(row.correct_answer)
    }));
    
    res.json(formattedRows);
  } catch (error) {
    console.error('❌ Error al obtener preguntas:', error);
    res.status(500).json({ 
      message: 'Error al obtener preguntas',
      error: error.message 
    });
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
// Ruta para actualizar una pregunta existente
router.put('/:id', verifyToken, isTeacherOrAdmin, upload.single('image'), async (req, res) => {
  console.log('=== SOLICITUD PUT A /api/questions/' + req.params.id + ' ===');
  console.log('Cuerpo de la solicitud:', req.body);
  console.log('Archivo adjunto:', req.file ? 'Sí' : 'No');
  console.log('Usuario autenticado:', req.user);
  try {
    const { id } = req.params;
    const { questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category } = req.body;

    // Validar campos requeridos
    if (!questionnaire_id || !question_text || !option1 || !option2 || !correct_answer || !category) {
      return res.status(400).json({
        message: 'Faltan campos obligatorios',
        error: 'MISSING_REQUIRED_FIELDS',
        requiredFields: ['questionnaire_id', 'question_text', 'option1', 'option2', 'correct_answer', 'category']
      });
    }

    // Verificar que la pregunta exista
    const [qRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [id]);
    if (qRows.length === 0) {
      return res.status(404).json({ 
        message: 'Pregunta no encontrada.',
        error: 'QUESTION_NOT_FOUND'
      });
    }

    // Verificar que el cuestionario exista
    const [questionnaire] = await pool.query('SELECT id FROM questionnaires WHERE id = ?', [questionnaire_id]);
    if (questionnaire.length === 0) {
      return res.status(404).json({
        message: 'El cuestionario especificado no existe',
        error: 'QUESTIONNAIRE_NOT_FOUND'
      });
    }

    // Verificar permisos para docentes
    if (req.user.role === 'docente') {
      const isOwner = await checkOwnership(id, req.user.id);
      if (!isOwner) {
        console.error(`Acceso denegado: El usuario ${req.user.id} no es propietario de la pregunta ${id}`);
        return res.status(403).json({ 
          message: 'No tienes permiso para modificar esta pregunta.',
          error: 'FORBIDDEN',
          details: 'El cuestionario no pertenece al docente actual'
        });
      }
    }

    // Manejar la imagen
    let image_url = qRows[0].image_url; // Mantener la imagen actual por defecto
    
    if (req.file) {
      // Si hay un nuevo archivo, usar el nuevo
      image_url = `/uploads/${req.file.filename}`;
    } else if (req.body.image_url === '') {
      // Si se envió image_url vacío, significa que se quiere eliminar la imagen
      image_url = null;
    }

    // Validar que la respuesta correcta sea una de las opciones
    const options = [option1, option2, option3, option4].filter(Boolean);
    if (!options.includes(correct_answer)) {
      return res.status(400).json({
        message: 'La respuesta correcta debe ser una de las opciones proporcionadas',
        error: 'INVALID_CORRECT_ANSWER'
      });
    }

    // Actualizar la pregunta
    const [result] = await pool.query(
      `UPDATE questions SET 
        questionnaire_id = ?, 
        question_text = ?, 
        option1 = ?, 
        option2 = ?, 
        option3 = ?, 
        option4 = ?, 
        correct_answer = ?, 
        category = ?, 
        image_url = ? 
      WHERE id = ?`,
      [
        questionnaire_id, 
        question_text, 
        option1, 
        option2, 
        option3 || null, 
        option4 || null, 
        correct_answer, 
        category, 
        image_url, 
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'No se pudo actualizar la pregunta',
        error: 'UPDATE_FAILED'
      });
    }

    // Obtener la pregunta actualizada para devolverla
    const [updatedQuestion] = await pool.query('SELECT * FROM questions WHERE id = ?', [id]);
    
    res.json({ 
      message: 'Pregunta actualizada exitosamente',
      question: updatedQuestion[0]
    });
  } catch (error) {
    console.error('❌ Error al actualizar la pregunta:', error);
    
    // Manejar errores específicos de la base de datos
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        message: 'El cuestionario especificado no existe',
        error: 'INVALID_QUESTIONNAIRE_ID',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      message: 'Error al actualizar la pregunta',
      error: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Eliminar una pregunta
router.delete('/:id', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la pregunta exista
    const [qRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [id]);
    if (qRows.length === 0) {
      return res.status(404).json({ 
        message: 'Pregunta no encontrada.',
        error: 'QUESTION_NOT_FOUND'
      });
    }

    // Verificar permisos para docentes
    if (req.user.role === 'docente') {
      const isOwner = await checkOwnership(id, req.user.id);
      if (!isOwner) {
        console.error(`Acceso denegado: El usuario ${req.user.id} no es propietario de la pregunta ${id}`);
        return res.status(403).json({ 
          message: 'No tienes permiso para eliminar esta pregunta.',
          error: 'FORBIDDEN',
          details: 'El cuestionario no pertenece al docente actual'
        });
      }
    }

    await pool.query('DELETE FROM questions WHERE id = ?', [id]);
    res.json({ message: 'Pregunta eliminada' });
  } catch (error) {
    console.error('❌ Error al eliminar pregunta:', error);
    res.status(500).json({ message: 'Error al eliminar la pregunta' });
  }
});

export default router;
