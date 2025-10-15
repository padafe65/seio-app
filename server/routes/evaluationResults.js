// routes/evaluationResults.js
import express from 'express';
import db from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Obtener todos los resultados de evaluación
router.get('/', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    console.log(`📊 Usuario solicitando resultados: ${user.role} (ID: ${user.id})`);
    
    let query = `
      SELECT er.*, 
             s.name as student_name,
             q.title as questionnaire_title,
             q.phase,
             c.name as course_name,
             c.id as course_id
      FROM evaluation_results er
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      JOIN students st ON qa.student_id = st.id
      JOIN users s ON st.user_id = s.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      LEFT JOIN courses c ON st.course_id = c.id
    `;
    
    let params = [];
    
    // Si es docente, filtrar solo sus estudiantes
    if (user.role === 'docente') {
      query += `
        JOIN teacher_students ts ON st.id = ts.student_id
        JOIN teachers t ON ts.teacher_id = t.id
        WHERE t.user_id = ?
      `;
      params.push(user.id);
      console.log(`📚 Filtrando resultados para docente: ${user.id}`);
    } else if (user.role === 'admin' || user.role === 'super_administrador') {
      console.log(`👑 Admin/SuperAdmin: mostrando todos los resultados`);
      // No agregar filtros, mostrar todos los resultados
    } else {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    
    query += ` ORDER BY er.recorded_at DESC`;
    
    const [results] = await db.query(query, params);
    console.log(`📊 Total de resultados obtenidos: ${results.length}`);
    
    res.json(results);
  } catch (error) {
    console.error('Error al obtener resultados:', error);
    res.status(500).json({ message: 'Error al obtener resultados' });
  }
});

// Obtener un resultado específico por ID
router.get('/:id', async (req, res) => {
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
router.get('/student/:id', async (req, res) => {
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
router.get('/user/:userId', async (req, res) => {
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
