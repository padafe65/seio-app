// routes/evaluationResults.js
import express from 'express';
import db, { withTransaction } from '../config/db.js';
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
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const teacherId = req.user?.teacher_id;
  const updateData = req.body;

  console.log('Solicitud de actualización recibida:', { 
    userId, 
    userRole, 
    teacherId,
    updateData 
  });

  try {
    // Verificar que el resultado existe y obtener información adicional
    const [existingResults] = await db.query(
      `SELECT er.*, 
              q.created_by as questionnaire_teacher_id, 
              er.student_id,
              q.phase as questionnaire_phase,
              (SELECT MIN(score) FROM quiz_attempts 
               WHERE student_id = er.student_id 
               AND questionnaire_id = er.questionnaire_id) as min_score,
              (SELECT MAX(score) FROM quiz_attempts 
               WHERE student_id = er.student_id 
               AND questionnaire_id = er.questionnaire_id) as max_score,
              (SELECT COUNT(*) FROM quiz_attempts 
               WHERE student_id = er.student_id 
               AND questionnaire_id = er.questionnaire_id) as total_attempts
       FROM evaluation_results er
       JOIN questionnaires q ON er.questionnaire_id = q.id
       WHERE er.id = ?`, 
      [id]
    );
    
    // Obtener todos los intentos del estudiante para este cuestionario
    if (existingResults && existingResults.length > 0) {
      const [attempts] = await db.query(
        `SELECT * FROM quiz_attempts 
         WHERE student_id = ? AND questionnaire_id = ?
         ORDER BY attempt_number`,
        [existingResults[0].student_id, existingResults[0].questionnaire_id]
      );
      
      // Agregar los intentos a los resultados
      existingResults[0].all_attempts = attempts || [];
      
      // Agregar información de puntuaciones
      if (existingResults[0].all_attempts.length > 0) {
        // Ordenar intentos por puntuación para encontrar el mínimo y máximo
        const sortedAttempts = [...existingResults[0].all_attempts].sort((a, b) => a.score - b.score);
        existingResults[0].min_score = parseFloat(sortedAttempts[0].score);
        existingResults[0].max_score = parseFloat(sortedAttempts[sortedAttempts.length - 1].score);
      } else {
        // Si no hay intentos, usar los valores de la evaluación
        existingResults[0].min_score = parseFloat(existingResults[0].score) || 0;
        existingResults[0].max_score = parseFloat(existingResults[0].score) || 0;
      }
      
      // Asegurarse de que best_score y min_score estén definidos
      existingResults[0].best_score = existingResults[0].best_score || existingResults[0].max_score || 0;
    }
    
    if (existingResults.length === 0) {
      console.log('Resultado de evaluación no encontrado para ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Resultado de evaluación no encontrado'
      });
    }

    const result = existingResults[0];
    
    // Verificar permisos
    if (userRole === 'estudiante') {
      // Los estudiantes solo pueden ver sus propios resultados, no editarlos
      console.log('Intento de actualización denegado: rol estudiante no tiene permisos');
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para actualizar este resultado'
      });
    } else if (userRole === 'docente') {
      // Verificar que el cuestionario pertenece al docente
      if (result.questionnaire_teacher_id !== teacherId) {
        console.log('Intento de actualización denegado: el cuestionario no pertenece al docente');
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para actualizar este resultado'
        });
      }
      
      // Verificar que el estudiante está asignado al docente
      const hasAccess = await checkTeacherStudentAccess(teacherId, result.student_id);
      if (!hasAccess) {
        console.log('Intento de actualización denegado: el estudiante no está asignado al docente');
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para actualizar este resultado'
        });
      }
    } else if (userRole !== 'super_administrador') {
      // Solo super administradores pueden hacer cualquier cosa
      console.log('Intento de actualización denegado: rol no autorizado');
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para realizar esta acción'
      });
    }
    
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

    // Usar la función withTransaction para manejar la transacción
    let updatedResult;
    try {
      updatedResult = await withTransaction(async (connection) => {
      // 1. Verificar que todas las referencias existen antes de actualizar
      const [existingAttempt] = await connection.query(
        'SELECT id, student_id, questionnaire_id, score FROM quiz_attempts WHERE id = ?', 
        [result.selected_attempt_id]
      );
      
      if (existingAttempt.length === 0) {
        throw new Error('El intento seleccionado no existe');
      }
      
      const attemptId = existingAttempt[0].id;
      const student_id = result.student_id;
      const questionnaire_id = result.questionnaire_id;
      
      // Verificar que el estudiante existe
      const [student] = await connection.query(
        'SELECT id FROM students WHERE id = ?',
        [student_id]
      );
      
      if (student.length === 0) {
        throw new Error('El estudiante especificado no existe');
      }
      
      // Verificar que el cuestionario existe
      const [questionnaire] = await connection.query(
        'SELECT id, phase FROM questionnaires WHERE id = ?',
        [questionnaire_id]
      );
      
      if (questionnaire.length === 0) {
        throw new Error('El cuestionario especificado no existe');
      }
      
      const phase = updates.questionnaire?.phase !== undefined ? 
                   updates.questionnaire.phase : 
                   questionnaire[0].phase;
      
      const phaseField = `phase_${phase}_score`;
      
      // 2. Actualizar datos del cuestionario si es necesario
      if (updates.questionnaire && Object.keys(updates.questionnaire).length > 0) {
        const updateData = { ...updates.questionnaire };
        
        // Asegurarse de que la fase sea un número si está presente
        if (updateData.phase !== undefined) {
          // Convertir 'Fase X' a número (1, 2, 3, etc.)
          if (typeof updateData.phase === 'string' && updateData.phase.startsWith('Fase ')) {
            updateData.phase = parseInt(updateData.phase.replace('Fase ', ''), 10);
          }
          // Asegurarse de que sea un número válido
          updateData.phase = isNaN(updateData.phase) ? 0 : updateData.phase;
          
          console.log(`Actualizando fase del cuestionario ${questionnaire_id} a:`, updateData.phase);
        }
        
        await connection.query(
          'UPDATE questionnaires SET ? WHERE id = ?',
          [updateData, questionnaire_id]
        );
        
        console.log('Cuestionario actualizado con éxito');
      }
      
      // 3. Actualizar el intento si hay cambios
      if (updates.attempt && Object.keys(updates.attempt).length > 0) {
        // Actualizar el intento específico
        await connection.query(
          'UPDATE quiz_attempts SET ? WHERE id = ?',
          [updates.attempt, attemptId]
        );
        
        // Obtener todos los intentos para este estudiante y cuestionario
        const [allAttempts] = await connection.query(
          'SELECT id, score FROM quiz_attempts WHERE student_id = ? AND questionnaire_id = ?',
          [student_id, questionnaire_id]
        );
        
        // Encontrar el mejor puntaje entre todos los intentos
        let bestScore = 0;
        let bestAttemptId = null;
        
        allAttempts.forEach(attempt => {
          const score = parseFloat(attempt.score);
          if (score > bestScore) {
            bestScore = score;
            bestAttemptId = attempt.id;
          }
        });
        
        console.log(`Mejor puntaje encontrado: ${bestScore} (intento ${bestAttemptId})`);
        
        // Actualizar el mejor puntaje y la fase en la tabla de resultados
        const updateData = {
          best_score: bestScore,
          selected_attempt_id: bestAttemptId,
          phase: phase // Asegurarse de actualizar la fase
        };
        
        await connection.query(
          'UPDATE evaluation_results SET ? WHERE id = ?',
          [updateData, id]
        );
        
        console.log(`Resultado actualizado con mejor puntaje: ${bestScore}, intento: ${bestAttemptId}, fase: ${phase}`);
        
        // Actualizar la tabla de promedios de fase
        const [phaseAveragesResult] = await connection.query(
          `SELECT AVG(CAST(qa.score AS DECIMAL(10,2))) as avg_score, 
                  COUNT(*) as count
           FROM quiz_attempts qa
           JOIN evaluation_results er ON qa.id = er.selected_attempt_id
           JOIN questionnaires q ON er.questionnaire_id = q.id
           WHERE er.student_id = ? AND q.phase = ?`,
          [student_id, phase]
        );
        
        const phaseAverageScore = parseFloat(phaseAveragesResult[0]?.avg_score || 0);
        const phaseEvaluationsCount = parseInt(phaseAveragesResult[0]?.count || 0);
        
        console.log(`Promedio calculado para fase ${phase}: ${phaseAverageScore} (${phaseEvaluationsCount} evaluaciones)`);
        
        // Actualizar o insertar en phase_averages
        await connection.query(
          `INSERT INTO phase_averages (student_id, teacher_id, phase, average_score, evaluations_completed)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             average_score = VALUES(average_score),
             evaluations_completed = VALUES(evaluations_completed)`,
          [student_id, teacherId, phase, phaseAverageScore, phaseEvaluationsCount]
        );
        
        // Actualizar la tabla de calificaciones (grades) si es necesario
        const [existingGrade] = await connection.query(
          'SELECT * FROM grades WHERE student_id = ?',
          [student_id]
        );
        
        if (existingGrade.length > 0) {
          // Actualizar la fase específica solo si el nuevo puntaje es mayor
          const currentPhaseScore = parseFloat(existingGrade[0][phaseField] || 0);
          if (bestScore > currentPhaseScore) {
            await connection.query(
              `UPDATE grades SET ${phaseField} = ? WHERE student_id = ?`,
              [bestScore, student_id]
            );
            console.log(`Fase ${phase} actualizada en la tabla grades`);
          }
        } else {
          // Insertar un nuevo registro con la fase actual
          const gradeData = { student_id };
          gradeData[phaseField] = bestScore;
          
          await connection.query(
            'INSERT INTO grades SET ?',
            [gradeData]
          );
          console.log(`Nuevo registro creado en grades para el estudiante ${student_id}`);
        }
        
        // El código de actualización de promedios ya se ejecutó anteriormente, no es necesario repetirlo
      } else {
        // Si no se está actualizando el score, solo actualizar los demás campos normalmente
        if (Object.keys(updates.attempt).length > 0) {
          await connection.query('UPDATE quiz_attempts SET ? WHERE id = ?', 
            [updates.attempt, attemptId]);
        }
        
        if (Object.keys(updates.result).length > 0) {
          await connection.query('UPDATE evaluation_results SET ? WHERE id = ?', 
            [updates.result, id]);
        }
      }

      // 5. Actualizar los intentos si vienen en la petición
      if (updates.attempts && Array.isArray(updates.attempts)) {
        for (const attempt of updates.attempts) {
          await connection.query(
            'UPDATE quiz_attempts SET score = ? WHERE id = ?',
            [attempt.score, attempt.id]
          );
        }
        
        // Recalcular el mejor puntaje basado en todos los intentos
        const [allAttempts] = await connection.query(
          'SELECT * FROM quiz_attempts WHERE student_id = ? AND questionnaire_id = ?',
          [result.student_id, result.questionnaire_id]
        );
        
        // Encontrar el mejor puntaje
        const bestAttempt = allAttempts.reduce((prev, current) => {
          return (parseFloat(prev?.score) > parseFloat(current?.score)) ? prev : current;
        }, { score: 0 });
        
        // Actualizar el best_score en evaluation_results
        await connection.query(
          'UPDATE evaluation_results SET best_score = ? WHERE id = ?',
          [bestAttempt.score, id]
        );
        
        console.log(`Mejor puntaje recalculado: ${bestAttempt.score}`);
      }
        
      // 6. Actualizar otros campos del resultado si los hay
      if (updates.result) {
        const resultUpdates = { ...updates.result };
        delete resultUpdates.best_score; // Ya manejamos best_score por separado
        
        if (Object.keys(resultUpdates).length > 0) {
          await connection.query(
            'UPDATE evaluation_results SET ? WHERE id = ?',
            [resultUpdates, id]
          );
        }
      }
      
      // Obtener el resultado actualizado con todos los intentos
      console.log('Obteniendo datos actualizados para el resultado ID:', id);
      
      // Primero obtener los datos básicos del resultado
      const [resultData] = await connection.query(`
        SELECT 
          er.*,
          s.id as student_id,
          s.user_id as student_user_id,
          us.name as student_name,
          us.email as student_email,
          s.grade as student_grade,
          q.id as questionnaire_id,
          q.title as questionnaire_title,
          q.description as questionnaire_description,
          q.phase as questionnaire_phase,
          t.id as created_by_teacher_id,
          u.name as teacher_name,
          c.id as course_id,
          c.name as course_name
        FROM evaluation_results er
        JOIN students s ON er.student_id = s.id
        JOIN users us ON s.user_id = us.id
        JOIN questionnaires q ON er.questionnaire_id = q.id
        JOIN teachers t ON q.created_by = t.id
        JOIN users u ON t.user_id = u.id
        LEFT JOIN courses c ON s.course_id = c.id
        WHERE er.id = ?`,
        [id]);
      
      if (resultData.length === 0) {
        throw new Error('No se pudo recuperar el resultado actualizado');
      }
      
      // Obtener todos los intentos para este estudiante y cuestionario
      const [attempts] = await connection.query(`
        SELECT 
          id as attempt_id,
          attempt_number,
          score as attempt_score,
          attempt_date,
          CASE WHEN id = ? THEN 1 ELSE 0 END as is_selected
        FROM quiz_attempts 
        WHERE student_id = ? AND questionnaire_id = ?
        ORDER BY attempt_number`,
        [resultData[0].selected_attempt_id, resultData[0].student_id, resultData[0].questionnaire_id]);
      
      // Combinar los datos del resultado con los intentos
      const updatedResults = [{
        ...resultData[0],
        attempts: attempts,
        total_attempts: attempts.length
      }];
      
      console.log('Datos actualizados obtenidos de la base de datos:', updatedResults);
      
      if (updatedResults.length === 0) {
        throw new Error('No se pudo recuperar el resultado actualizado');
      }

      return updatedResults[0]; // Return the updated result from the transaction
      }); // Cierre de withTransaction
    } catch (error) {
      console.error('Error en la transacción:', error);
      throw error; // Relanzar el error para que lo maneje el catch externo
    }
    
    if (!updatedResult) {
      return res.status(404).json({
        success: false,
        message: 'No se pudo actualizar el resultado'
      });
    }

    // Obtener los datos actualizados completos
    const [fullResult] = await db.query(`
      SELECT 
        er.*, 
        s.user_id as student_user_id, 
        us.name as student_name, 
        us.email as student_email,
        q.title as questionnaire_title, 
        q.description as questionnaire_description, 
        q.phase as questionnaire_phase,
        t.id as created_by_teacher_id, 
        u.name as teacher_name,
        c.id as course_id, 
        c.name as course_name,
        s.grade as student_grade
      FROM evaluation_results er
      JOIN students s ON er.student_id = s.id
      JOIN users us ON s.user_id = us.id
      JOIN questionnaires q ON er.questionnaire_id = q.id
      JOIN teachers t ON q.created_by = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE er.id = ?
    `, [id]);

    // Obtener los intentos actualizados
    const [attempts] = await db.query(
      'SELECT * FROM quiz_attempts WHERE student_id = ? AND questionnaire_id = ? ORDER BY attempt_number',
      [fullResult[0].student_id, fullResult[0].questionnaire_id]
    );

    const resultData = {
      ...fullResult[0],
      attempts: attempts,
      student: {
        id: fullResult[0].student_id,
        user_id: fullResult[0].student_user_id,
        name: fullResult[0].student_name,
        email: fullResult[0].student_email,
        grade: fullResult[0].student_grade
      },
      // Asegurarse de que best_score se incluya en la respuesta
      best_score: fullResult[0].best_score,
      attempt: {
        id: fullResult[0].selected_attempt_id,
        score: fullResult[0].score,
        attempt_number: fullResult[0].attempt_number,
        attempt_date: fullResult[0].attempt_date,
        completed_at: fullResult[0].completed_at
      },
      questionnaire: {
        id: fullResult[0].questionnaire_id,
        title: fullResult[0].questionnaire_title,
        description: fullResult[0].questionnaire_description,
        phase: fullResult[0].questionnaire_phase,
        created_by: {
          id: fullResult[0].created_by_teacher_id,
          name: fullResult[0].teacher_name
        }
      },
      course: fullResult[0].course_id ? {
        id: fullResult[0].course_id,
        name: fullResult[0].course_name
      } : null
    };

    // Devolver los datos actualizados completos
    res.json({
      success: true,
      message: 'Resultado actualizado exitosamente',
      data: resultData
    });
  } catch (error) {
    console.error('Error al actualizar el resultado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el resultado',
      error: error.message
    });
  }
});

// Obtener un resultado de evaluación por ID con todos los intentos
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
        st.grade as student_grade,
        (SELECT COUNT(*) FROM quiz_attempts WHERE student_id = st.id AND questionnaire_id = q.id) as total_attempts
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
