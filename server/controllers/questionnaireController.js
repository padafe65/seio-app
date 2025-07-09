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

    // Consulta para obtener el cuestionario con información del creador
    const query = `
      SELECT q.*, 
             u.name as created_by_name, 
             u.email as created_by_email,
             c.name as course_name,
             (SELECT COUNT(*) FROM questions WHERE questionnaire_id = q.id) as question_count
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE q.id = ?
    `;
    
    const [questionnaires] = await pool.query(query, [id]);
    
    if (!questionnaires || questionnaires.length === 0) {
      return res.status(404).json({ 
        message: 'Cuestionario no encontrado',
        error: 'NOT_FOUND'
      });
    }
    
    const questionnaire = questionnaires[0];
    
    // Verificar permisos
    if (req.user.role === 'docente' && questionnaire.created_by !== req.user.teacher_id) {
      return res.status(403).json({ 
        message: 'No tienes permiso para ver este cuestionario',
        error: 'FORBIDDEN',
        details: 'Solo puedes ver tus propios cuestionarios'
      });
    }
    
    // Formatear la respuesta
    const response = {
      ...questionnaire,
      metadata: {
        question_count: questionnaire.question_count,
        created_at: questionnaire.created_at,
        updated_at: questionnaire.updated_at
      }
    };
    
    // Eliminar campos innecesarios
    delete response.question_count;
    
    res.status(200).json({
      message: 'Cuestionario obtenido correctamente',
      data: response
    });
    
  } catch (error) {
    console.error('Error al obtener cuestionario por ID:', error);
    res.status(500).json({ 
      message: 'Error del servidor al obtener el cuestionario',
      error: error.message,
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
