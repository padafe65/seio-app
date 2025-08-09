// routes/evaluationResults.js
import express from 'express';
import db from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken);

// Función para obtener el ID del profesor a partir del user_id
async function getTeacherIdFromUserId(userId) {
  const [teachers] = await db.query('SELECT id FROM teachers WHERE user_id = ?', [userId]);
  return teachers.length > 0 ? teachers[0].id : null;
}

// Función para verificar si un estudiante está asignado a un profesor
async function checkTeacherStudentAccess(teacherId, studentId) {
  const [results] = await db.query(
    'SELECT 1 FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
    [teacherId, studentId]
  );
  return results.length > 0;
}

// Función para verificar si un cuestionario pertenece a un profesor
async function checkQuestionnaireOwnership(teacherId, questionnaireId) {
  const [results] = await db.query(
    'SELECT 1 FROM questionnaires WHERE id = ? AND created_by = ?',
    [questionnaireId, teacherId]
  );
  return results.length > 0;
}

// Obtener un resultado de evaluación por ID
// Actualizar un resultado de evaluación
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const updateData = req.body;

  try {
    // Verificar que el resultado existe
    const [existingResult] = await db.query('SELECT * FROM evaluation_results WHERE id = ?', [id]);
    if (existingResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resultado de evaluación no encontrado'
      });
    }

    const result = existingResult[0];
    
    // Verificación de permisos (similar a la ruta GET)
    if (userRole === 'docente') {
      const teacherId = await getTeacherIdFromUserId(userId);
      if (!teacherId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para actualizar este resultado'
        });
      }
    }

    // Campos permitidos para actualizar
    const allowedUpdates = {
      student: ['grade'],
      attempt: ['score', 'attempt_number', 'attempt_date'],
      result: ['status', 'comments'],
      questionnaire: ['title', 'description', 'phase']
    };

    // Preparar las actualizaciones
    const updates = {
      student: {},
      attempt: {},
      result: {},
      questionnaire: {}
    };

    // Filtrar solo los campos permitidos
    Object.keys(updateData).forEach(section => {
      if (allowedUpdates[section]) {
        Object.keys(updateData[section]).forEach(field => {
          if (allowedUpdates[section].includes(field)) {
            updates[section][field] = updateData[section][field];
          }
        });
      }
    });

    // Iniciar transacción
    await db.beginTransaction();

    try {
      // Obtener el ID del intento
      const [attemptResult] = await db.query(
        'SELECT id FROM quiz_attempts WHERE id = ?', 
        [result.selected_attempt_id]
      );
      
      if (attemptResult.length === 0) {
        throw new Error('Intento no encontrado');
      }
      
      const attemptId = attemptResult[0].id;

      // Actualizar datos del estudiante si es necesario
      if (Object.keys(updates.student).length > 0) {
        await db.query('UPDATE students SET ? WHERE id = ?', 
          [updates.student, result.student_id]);
      }

      // Actualizar datos del intento si es necesario
      if (Object.keys(updates.attempt).length > 0) {
        await db.query('UPDATE quiz_attempts SET ? WHERE id = ?', 
          [updates.attempt, attemptId]);
      }

      // Actualizar datos del resultado si es necesario
      if (Object.keys(updates.result).length > 0) {
        await db.query('UPDATE evaluation_results SET ? WHERE id = ?', 
          [updates.result, id]);
      }

      // Actualizar datos del cuestionario si es necesario
      if (Object.keys(updates.questionnaire).length > 0) {
        await db.query('UPDATE questionnaires SET ? WHERE id = ?', 
          [updates.questionnaire, result.questionnaire_id]);
      }

      await db.commit();
      
      // Obtener los datos actualizados
      const [updatedResults] = await db.query(`
        SELECT 
          er.*, 
          s.name as student_name,
          s.email as student_email,
          s.grade as student_grade,
          q.title as questionnaire_title,
          q.description as questionnaire_description,
          q.phase,
          q.id as questionnaire_id,
          c.name as course_name,
          c.id as course_id,
          qa.id as attempt_id,
          qa.score,
          qa.attempt_date as completed_at,
          qa.attempt_number,
          qa.attempt_date,
          st.id as student_id,
          st.user_id as student_user_id
        FROM evaluation_results er
        JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
        JOIN students st ON qa.student_id = st.id
        JOIN users s ON st.user_id = s.id
        JOIN questionnaires q ON qa.questionnaire_id = q.id
        LEFT JOIN courses c ON st.course_id = c.id
        WHERE er.id = ?
      `, [id]);

      if (updatedResults.length === 0) {
        throw new Error('No se pudo recuperar el resultado actualizado');
      }

      const updatedResult = updatedResults[0];
      
      // Formatear la respuesta
      const responseData = {
        ...updatedResult,
        attempt: {
          id: updatedResult.attempt_id,
          attempt_number: updatedResult.attempt_number,
          attempt_date: updatedResult.attempt_date,
          score: updatedResult.score,
          completed_at: updatedResult.completed_at
        },
        student: {
          id: updatedResult.student_id,
          user_id: updatedResult.student_user_id,
          name: updatedResult.student_name,
          email: updatedResult.student_email,
          grade: updatedResult.student_grade
        },
        questionnaire: {
          id: updatedResult.questionnaire_id,
          title: updatedResult.questionnaire_title,
          description: updatedResult.questionnaire_description,
          phase: updatedResult.phase
        }
      };

      // Eliminar campos duplicados
      [
        'attempt_id', 'attempt_number', 'attempt_date', 'score', 'completed_at',
        'student_id', 'student_user_id', 'student_name', 'student_email', 'student_grade',
        'questionnaire_id', 'questionnaire_title', 'questionnaire_description', 'phase'
      ].forEach(field => delete responseData[field]);

      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error al actualizar el resultado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el resultado',
      error: error.message
    });
  }
});

// Obtener un resultado de evaluación por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado: Usuario no autenticado'
      });
    }
    
    // Consulta para obtener el resultado de evaluación con información relacionada
    const query = `
      SELECT 
        er.*, 
        s.name as student_name,
        s.email as student_email,
        q.title as questionnaire_title,
        q.description as questionnaire_description,
        q.phase,
        q.id as questionnaire_id,
        q.created_by as questionnaire_created_by,
        c.name as course_name,
        c.id as course_id,
        er.status as evaluation_status,
        qa.id as attempt_id,
        qa.score,
        qa.attempt_date as completed_at,
        qa.attempt_number,
        qa.attempt_date,
        st.id as student_id,
        st.user_id as student_user_id,
        st.grade as student_grade
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
    
    // Verificación de permisos
    if (userRole === 'docente') {
      const teacherId = await getTeacherIdFromUserId(userId);
      
      // Verificar si el cuestionario pertenece al docente o si el estudiante está asignado al docente
      const [isQuestionnaireOwner, hasStudentAccess] = await Promise.all([
        checkQuestionnaireOwnership(teacherId, result.questionnaire_id),
        checkTeacherStudentAccess(teacherId, result.student_id)
      ]);
      
      console.log(`🔍 Verificación de permisos para resultado ${id}:`, {
        teacherId,
        questionnaireId: result.questionnaire_id,
        studentId: result.student_id,
        isQuestionnaireOwner,
        hasStudentAccess
      });
      
      // Permitir acceso si el docente es dueño del cuestionario o tiene acceso al estudiante
      if (!isQuestionnaireOwner && !hasStudentAccess) {
        console.warn(`⛔ Acceso denegado para el docente ${teacherId} al resultado ${id}`);
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este resultado de evaluación'
        });
      }
    } else if (userRole === 'estudiante') {
      // Verificar si el estudiante está viendo sus propios resultados
      if (result.student_user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes ver tus propios resultados'
        });
      }
    }
    // Los super_administradores y administradores pueden ver todo
    
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
    
    // Crear un objeto con los datos del intento
    result.attempt = {
      id: result.attempt_id,
      attempt_number: result.attempt_number,
      attempt_date: result.attempt_date,
      score: result.score,
      completed_at: result.completed_at
    };
    
    // Eliminar campos duplicados
    delete result.attempt_id;
    delete result.attempt_number;
    delete result.attempt_date;
    
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
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener resultados del curso',
      error: error.message 
    });
  }
});

// Obtener resultados para un profesor (por sus estudiantes y cuestionarios)
router.get('/teacher/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;
    const userRole = req.user?.role;
    
    // Verificar que el usuario esté autenticado
    if (!requestingUserId) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado: Usuario no autenticado'
      });
    }
    
    // Verificar que el usuario esté viendo sus propios resultados o sea administrador
    if (requestingUserId !== userId && userRole !== 'super_administrador') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estos resultados'
      });
    }
    
    // Obtener el ID del profesor
    const [teachers] = await db.query('SELECT id FROM teachers WHERE user_id = ?', [userId]);
    
    if (teachers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Profesor no encontrado'
      });
    }
    
    const teacherId = teachers[0].id;
    
    // Consulta para obtener los resultados de los cuestionarios creados por el profesor
    const [results] = await db.query(`
      SELECT 
        er.*,
        s.id as student_id,
        s.user_id as student_user_id,
        u.name as student_name,
        u.email as student_email,
        q.title as questionnaire_title,
        q.id as questionnaire_id,
        q.created_by as questionnaire_created_by,
        c.id as course_id,
        c.name as course_name,
        qa.score,
        qa.attempt_date as completed_at
      FROM evaluation_results er
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      JOIN students s ON qa.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE q.created_by = ?
      ORDER BY c.name, u.name, qa.attempt_date DESC
    `, [teacherId]);
    
    // Procesar los resultados para agrupar por curso y estudiante
    const groupedResults = results.reduce((acc, result) => {
      const courseId = result.course_id || 'sin_curso';
      const studentId = result.student_id;
      
      if (!acc[courseId]) {
        acc[courseId] = {
          course_id: result.course_id,
          course_name: result.course_name || 'Sin curso asignado',
          students: {}
        };
      }
      
      if (!acc[courseId].students[studentId]) {
        acc[courseId].students[studentId] = {
          student_id: result.student_id,
          student_user_id: result.student_user_id,
          student_name: result.student_name,
          student_email: result.student_email,
          results: []
        };
      }
      
      // Asegurar que los campos numéricos sean números
      const numericFields = ['score', 'correct_answers', 'incorrect_answers', 'total_questions'];
      numericFields.forEach(field => {
        if (result[field] !== undefined && result[field] !== null) {
          result[field] = Number(result[field]);
        }
      });
      
      // Procesar campos JSON
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
      
      acc[courseId].students[studentId].results.push({
        id: result.id,
        questionnaire_id: result.questionnaire_id,
        questionnaire_title: result.questionnaire_title,
        score: result.score,
        status: result.status,
        completed_at: result.completed_at,
        correct_answers: result.correct_answers,
        incorrect_answers: result.incorrect_answers,
        total_questions: result.total_questions
      });
      
      return acc;
    }, {});
    
    // Convertir el objeto en un array para la respuesta
    const response = Object.values(groupedResults).map(course => ({
      ...course,
      students: Object.values(course.students)
    }));
    
    res.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('Error al obtener resultados del docente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los resultados del docente',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
