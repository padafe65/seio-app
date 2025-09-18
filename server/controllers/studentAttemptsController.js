import pool from '../config/db.js';

// Obtener todos los intentos de un estudiante
export const getStudentAttempts = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    // Consulta para obtener los intentos del cuestionario del estudiante
    const [attempts] = await pool.query(`
      SELECT 
        qa.*,
        q.title as quiz_title,
        q.description as quiz_description,
        q.course_id,
        c.name as course_name
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE qa.student_id = ?
      ORDER BY qa.completed_at DESC
    `, [studentId]);

    // Mapear los resultados para incluir solo los campos necesarios
    const formattedAttempts = attempts.map(attempt => ({
      id: attempt.id,
      score: attempt.score,
      completed_at: attempt.completed_at,
      status: attempt.status || 'completed',
      quiz: {
        id: attempt.quiz_id,
        title: attempt.quiz_title,
        description: attempt.quiz_description,
        course: {
          id: attempt.course_id,
          name: attempt.course_name
        }
      }
    }));

    res.json(formattedAttempts);
  } catch (error) {
    console.error('Error al obtener intentos del estudiante:', error);
    res.status(500).json({ 
      error: 'Error al obtener los intentos del estudiante',
      details: error.message
    });
  }
};

// Obtener un intento específico de un estudiante
export const getStudentAttemptById = async (req, res) => {
  try {
    const { studentId, attemptId } = req.params;
    
    // Obtener la información básica del intento
    const [attempts] = await pool.query(`
      SELECT 
        qa.*,
        q.title as quiz_title,
        q.description as quiz_description,
        q.course_id,
        c.name as course_name
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE qa.id = ? AND qa.student_id = ?
    `, [attemptId, studentId]);

    if (attempts.length === 0) {
      return res.status(404).json({ error: 'Intento no encontrado' });
    }

    const attempt = attempts[0];
    
    // Obtener las respuestas del intento
    const [responses] = await pool.query(`
      SELECT 
        qr.*,
        q.question_text,
        q.correct_answer
      FROM quiz_responses qr
      JOIN questions q ON qr.question_id = q.id
      WHERE qr.attempt_id = ?
    `, [attemptId]);

    // Formatear la respuesta
    const response = {
      id: attempt.id,
      score: attempt.score,
      completed_at: attempt.completed_at,
      status: attempt.status || 'completed',
      quiz: {
        id: attempt.quiz_id,
        title: attempt.quiz_title,
        description: attempt.quiz_description,
        course: {
          id: attempt.course_id,
          name: attempt.course_name
        }
      },
      responses: responses.map(r => ({
        question_id: r.question_id,
        question_text: r.question_text,
        selected_answer: r.selected_answer,
        is_correct: r.selected_answer === r.correct_answer,
        correct_answer: r.correct_answer
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Error al obtener el intento del estudiante:', error);
    res.status(500).json({ 
      error: 'Error al obtener el intento del estudiante',
      details: error.message
    });
  }
};
