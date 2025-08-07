// routes/evaluationResults.js
import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener un resultado de evaluación por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Consulta para obtener el resultado de evaluación con información relacionada
    const query = `
      SELECT 
        er.*, 
        s.name as student_name,
        s.email as student_email,
        q.title as questionnaire_title,
        q.phase,
        q.id as questionnaire_id,
        c.name as course_name,
        c.id as course_id,
        er.status as evaluation_status,
        qa.id as attempt_id,
        qa.score,
        qa.attempt_date as completed_at,
        st.id as student_id,
        st.user_id as student_user_id
      FROM evaluation_results er
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      JOIN students st ON qa.student_id = st.id
      JOIN users s ON st.user_id = s.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      LEFT JOIN courses c ON st.course_id = c.id
      WHERE er.id = ?
    `;
    
    const [results] = await db.query(query, [id]);
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Resultado de evaluación no encontrado' 
      });
    }
    
    const result = results[0];
    
    // Procesar datos JSON si existen
    const jsonFields = ['questionnaire_data', 'answers'];
    
    jsonFields.forEach(field => {
      if (result[field]) {
        try {
          result[field] = JSON.parse(result[field]);
        } catch (e) {
          console.error(`Error al parsear ${field}:`, e);
          result[field] = null;
        }
      }
    });
    
    // Asegurar que los campos numéricos sean números
    const numericFields = ['score', 'correct_answers', 'incorrect_answers', 'total_questions'];
    numericFields.forEach(field => {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = Number(result[field]);
      }
    });
    
    // Si hay respuestas, intentar parsearlas
    if (result.answers) {
      try {
        result.answers = JSON.parse(result.answers);
      } catch (e) {
        console.error('Error al parsear answers:', e);
      }
    }
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error al obtener el resultado de evaluación:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener el resultado de evaluación',
      error: error.message 
    });
  }
});

// Obtener todos los resultados de evaluación
router.get('/', async (req, res) => {
  try {
    const { teacherId, courseId } = req.query;

    let query = `
      SELECT er.*, 
             s.name as student_name,
             q.title as questionnaire_title,
             q.phase,
             c.name as course_name,
             er.status as evaluation_status
      FROM evaluation_results er
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      JOIN students st ON qa.student_id = st.id
      JOIN users s ON st.user_id = s.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      LEFT JOIN courses c ON st.course_id = c.id
    `;
    
    const params = [];
    let conditions = [];

    if (teacherId) {
      // Asegura que solo se obtengan estudiantes del profesor
      query += ` JOIN teacher_students ts ON st.id = ts.student_id`;
      conditions.push(`ts.teacher_id = ?`);
      params.push(teacherId);
    }

    if (courseId) {
      // Filtra por curso si se proporciona
      conditions.push(`st.course_id = ?`);
      params.push(courseId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY er.recorded_at DESC`;

    const [results] = await db.query(query, params);
    res.json(results);
  } catch (error) {
    console.error('Error al obtener resultados:', error);
    res.status(500).json({ message: 'Error al obtener resultados' });
  }
});

// Obtener un resultado específico por ID
router.get('/evaluation-results/:id', async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT er.*, 
             s.name as student_name,
             q.title as questionnaire_title,
             c.name as course_name
      FROM evaluation_results er
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      JOIN students st ON qa.student_id = st.id
      JOIN users s ON st.user_id = s.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      LEFT JOIN courses c ON st.course_id = c.id
      WHERE er.id = ?
    `, [req.params.id]);
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Resultado no encontrado' });
    }
    
    res.json(results[0]);
  } catch (error) {
    console.error('Error al obtener resultado:', error);
    res.status(500).json({ message: 'Error al obtener resultado' });
  }
});

// Obtener resultados de un estudiante específico (por student_id de la tabla students)
router.get('/evaluation-results/student/:id', async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT er.*, 
             q.title as questionnaire_title,
             q.category,
             q.phase
      FROM evaluation_results er
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      WHERE qa.student_id = ?
      ORDER BY er.recorded_at DESC
    `, [req.params.id]);
    res.json(results);
  } catch (error) {
    console.error('Error al obtener resultados del estudiante:', error);
    res.status(500).json({ message: 'Error al obtener resultados del estudiante' });
  }
});

// Obtener resultados de un estudiante por su user_id
router.get('/evaluation-results/user/:userId', async (req, res) => {
  try {
    // Primero obtenemos el student_id asociado con este user_id
    const [students] = await db.query(`
      SELECT id FROM students WHERE user_id = ?
    `, [req.params.userId]);
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    const studentId = students[0].id;
    
    // Ahora obtenemos los resultados usando el student_id
    const [results] = await db.query(`
      SELECT er.*, 
             q.title as questionnaire_title,
             q.category,
             q.phase
      FROM evaluation_results er
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      WHERE qa.student_id = ?
      ORDER BY er.recorded_at DESC
    `, [studentId]);
    
    res.json(results);
  } catch (error) {
    console.error('Error al obtener resultados del estudiante por user_id:', error);
    res.status(500).json({ message: 'Error al obtener resultados del estudiante' });
  }
});

// Obtener resultados por curso
router.get('/course/:id', async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT er.*, 
             s.name as student_name,
             q.title as questionnaire_title,
             c.name as course_name
      FROM evaluation_results er
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      JOIN students st ON qa.student_id = st.id
      JOIN users s ON st.user_id = s.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      JOIN courses c ON st.course_id = c.id
      WHERE st.course_id = ?
      ORDER BY er.recorded_at DESC
    `, [req.params.id]);
    res.json(results);
  } catch (error) {
    console.error('Error al obtener resultados del curso:', error);
    res.status(500).json({ message: 'Error al obtener resultados del curso' });
  }
});

// Obtener resultados para un profesor (por sus cursos asignados)
router.get('/teacher/:userId', async (req, res) => {
  try {
    // Primero obtenemos el teacher_id asociado con este user_id
    const [teachers] = await db.query(`
      SELECT id FROM teachers WHERE user_id = ?
    `, [req.params.userId]);
    
    if (teachers.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    const teacherId = teachers[0].id;
    
    // Obtenemos los cursos asignados a este profesor
    const [teacherCourses] = await db.query(`
      SELECT course_id FROM teacher_courses WHERE teacher_id = ?
    `, [teacherId]);
    
    if (teacherCourses.length === 0) {
      return res.json([]);
    }
    
    // Extraemos los IDs de los cursos
    const courseIds = teacherCourses.map(tc => tc.course_id);
    
    // Ahora obtenemos los resultados de los estudiantes en estos cursos
    const [results] = await db.query(`
      SELECT er.*, 
             s.name as student_name,
             q.title as questionnaire_title,
             c.name as course_name
      FROM evaluation_results er
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      JOIN students st ON qa.student_id = st.id
      JOIN users s ON st.user_id = s.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      JOIN courses c ON st.course_id = c.id
      WHERE st.course_id IN (?)
      ORDER BY er.recorded_at DESC
    `, [courseIds]);
    
    res.json(results);
  } catch (error) {
    console.error('Error al obtener resultados para el profesor:', error);
    res.status(500).json({ message: 'Error al obtener resultados para el profesor' });
  }
});

// Obtener detalles de un intento específico
router.get('/quiz-attempts/:id', async (req, res) => {
  try {
    const [attempts] = await db.query(`
      SELECT qa.*,
             s.name as student_name,
             q.title as questionnaire_title
      FROM quiz_attempts qa
      JOIN students st ON qa.student_id = st.id
      JOIN users s ON st.user_id = s.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      WHERE qa.id = ?
    `, [req.params.id]);
    
    if (attempts.length === 0) {
      return res.status(404).json({ message: 'Intento no encontrado' });
    }
    
    res.json(attempts[0]);
  } catch (error) {
    console.error('Error al obtener detalles del intento:', error);
    res.status(500).json({ message: 'Error al obtener detalles del intento' });
  }
});

// Obtener estudiante por user_id
router.get('/students/by-user/:userId', async (req, res) => {
  try {
    const [students] = await db.query(`
      SELECT s.*, u.name, u.email, c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.user_id = ?
    `, [req.params.userId]);
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    res.json(students[0]);
  } catch (error) {
    console.error('Error al obtener estudiante por user_id:', error);
    res.status(500).json({ message: 'Error al obtener estudiante por user_id' });
  }
});

// Obtener profesor por user_id
router.get('/teachers/by-user/:userId', async (req, res) => {
  try {
    const [teachers] = await db.query(`
      SELECT t.*, u.name, u.email
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.user_id = ?
    `, [req.params.userId]);
    
    if (teachers.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    res.json(teachers[0]);
  } catch (error) {
    console.error('Error al obtener profesor por user_id:', error);
    res.status(500).json({ message: 'Error al obtener profesor por user_id' });
  }
});

// Obtener cursos asignados a un profesor
router.get('/teachers/:id/courses', async (req, res) => {
  try {
    const [courses] = await db.query(`
      SELECT c.* 
      FROM courses c
      JOIN teacher_courses tc ON c.id = tc.course_id
      WHERE tc.teacher_id = ?
    `, [req.params.id]);
    
    res.json(courses);
  } catch (error) {
    console.error('Error al obtener cursos del profesor:', error);
    res.status(500).json({ message: 'Error al obtener cursos del profesor' });
  }
});

export default router;
