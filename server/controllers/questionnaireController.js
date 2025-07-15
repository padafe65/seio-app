import pool from '../config/db.js';
import { 
  verifyToken, 
  isTeacherOrAdmin,
  isAdmin 
} from '../middleware/authMiddleware.js';

/**
 * Obtiene un cuestionario por su ID con verificación de permisos
 */
const getQuestionnaireById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        message: 'Se requiere el ID del cuestionario',
        error: 'BAD_REQUEST'
      });
    }

    // 1. Obtener el cuestionario
    const [questionnaires] = await pool.query(
      `SELECT q.*, 
             u.name as created_by_name, 
             u.email as created_by_email,
             (SELECT COUNT(*) FROM questions WHERE questionnaire_id = q.id) as question_count
      FROM questionnaires q
      LEFT JOIN teachers t ON q.created_by = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE q.id = ?`,
      [id]
    );
    
    if (questionnaires.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cuestionario no encontrado'
      });
    }
    
    const questionnaire = questionnaires[0];
    
    // 2. Verificar permisos (solo el docente creador o admin puede ver)
    if (req.user.role === 'docente') {
      const [teacherRows] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      if (teacherRows.length === 0 || teacherRows[0].id !== questionnaire.created_by) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para ver este cuestionario'
        });
      }
    }
    
    // 3. Obtener las preguntas relacionadas con sus opciones
    const [questions] = await pool.query(
      `SELECT q.*, 
              (SELECT COUNT(*) FROM question_options WHERE question_id = q.id) as options_count,
              GROUP_CONCAT(DISTINCT qo.option_text ORDER BY qo.id SEPARATOR '|||') as options
       FROM questions q
       LEFT JOIN question_options qo ON q.id = qo.question_id
       WHERE q.questionnaire_id = ?
       GROUP BY q.id
       ORDER BY q.id ASC`,
      [id]
    );

    // 4. Procesar las preguntas y sus opciones
    const processedQuestions = questions.map(q => ({
      ...q,
      options: q.options ? q.options.split('|||') : []
    }));

    // 5. Obtener estudiantes asignados usando teacher_students
    const [assignedStudents] = await pool.query(
      `SELECT DISTINCT s.id, u.name, u.email 
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN teacher_students ts ON s.id = ts.student_id
       WHERE ts.teacher_id = ?`,
      [questionnaire.created_by]
    );

    // 6. Devolver la respuesta
    res.json({
      success: true,
      message: 'Cuestionario obtenido correctamente',
      data: {
        ...questionnaire,
        questions: processedQuestions,
        assigned_students: assignedStudents
      }
    });
    
  } catch (error) {
    console.error('❌ Error al obtener el cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el cuestionario',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Crea un nuevo cuestionario
 */
const createQuestionnaire = async (req, res) => {
  try {
    const { title, description, course_id, phase, grade, category } = req.body;
    
    // Validar campos requeridos
    if (!title || !course_id) {
      return res.status(400).json({
        message: 'El título y el curso son campos requeridos',
        error: 'VALIDATION_ERROR',
        fields: {
          title: !title ? 'El título es requerido' : undefined,
          course_id: !course_id ? 'El curso es requerido' : undefined
        }
      });
    }
    
    // Verificar que el usuario sea docente
    if (req.user.role !== 'docente' || !req.user.teacher_id) {
      return res.status(403).json({
        message: 'Solo los docentes pueden crear cuestionarios',
        error: 'FORBIDDEN'
      });
    }
    
    // Insertar el nuevo cuestionario
    const [result] = await pool.query(
      `INSERT INTO questionnaires 
       (title, description, course_id, created_by, phase, grade, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        course_id,
        req.user.teacher_id, // Usar el ID del docente del token
        phase || 'borrador',
        grade || null,
        category || null
      ]
    );
    
    // Obtener el cuestionario recién creado
    const [newQuestionnaire] = await pool.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [result.insertId]
    );
    
    if (!newQuestionnaire || newQuestionnaire.length === 0) {
      throw new Error('No se pudo recuperar el cuestionario recién creado');
    }
    
    res.status(201).json({
      message: 'Cuestionario creado correctamente',
      data: newQuestionnaire[0]
    });
    
  } catch (error) {
    console.error('Error al crear cuestionario:', error);
    
    // Manejar errores de duplicados
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Ya existe un cuestionario con ese título',
        error: 'DUPLICATE_ENTRY'
      });
    }
    
    res.status(500).json({
      message: 'Error del servidor al crear el cuestionario',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Exportar las funciones
export default {
  getQuestionnaireById,
  createQuestionnaire
};
