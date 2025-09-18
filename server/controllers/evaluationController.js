import pool from '../config/db.js';

/**
 * Obtener evaluaciones para un estudiante
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const getStudentEvaluations = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Verificar que el usuario sea el dueño del recurso o tenga permisos
    if (req.user.role === 'estudiante' && req.user.id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para acceder a este recurso'
      });
    }

    // Consulta para obtener las evaluaciones del estudiante
    const [evaluations] = await pool.query(`
      SELECT 
        q.id as quiz_id,
        q.title as quiz_title,
        q.description as quiz_description,
        q.phase_id,
        p.name as phase_name,
        q.course_id,
        c.name as course_name,
        qa.id as attempt_id,
        qa.score,
        qa.completed_at,
        qa.status,
        qa.attempt_number
      FROM students s
      JOIN courses c ON s.course_id = c.id
      JOIN quizzes q ON q.course_id = c.id
      JOIN phases p ON q.phase_id = p.id
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.student_id = s.id
      WHERE s.id = ?
      ORDER BY p.id, q.created_at ASC
    `, [studentId]);

    // Formatear la respuesta
    const formattedEvaluations = evaluations.map(evaluation => ({
      id: evaluation.quiz_id,
      title: evaluation.quiz_title,
      description: evaluation.quiz_description,
      phase: {
        id: evaluation.phase_id,
        name: evaluation.phase_name
      },
      course: {
        id: evaluation.course_id,
        name: evaluation.course_name
      },
      attempt: evaluation.attempt_id ? {
        id: evaluation.attempt_id,
        score: evaluation.score,
        completed_at: evaluation.completed_at,
        status: evaluation.status,
        attempt_number: evaluation.attempt_number
      } : null
    }));

    res.json({
      success: true,
      data: formattedEvaluations
    });
  } catch (error) {
    console.error('Error al obtener evaluaciones por fase:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las evaluaciones',
      details: error.message
    });
  }
};
