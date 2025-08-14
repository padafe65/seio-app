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

// Función para actualizar promedios de fase
async function updatePhaseAverages(connection, studentId, teacherId, phase) {
  console.log(`🔄 Iniciando actualización de promedios para estudiante ${studentId}, fase ${phase}`);
  
  try {
    // Calcular el promedio de la fase
    const [phaseAverages] = await connection.query(
      `SELECT AVG(er.best_score) as average_score, 
              COUNT(*) as evaluations_count,
              GROUP_CONCAT(CONCAT('ID:', er.id, '(', er.best_score, ')') SEPARATOR ', ') as evaluation_details
       FROM evaluation_results er
       JOIN questionnaires q ON er.questionnaire_id = q.id
       WHERE er.student_id = ? AND q.phase = ?
       GROUP BY er.student_id, q.phase`,
      [studentId, phase]
    );

    console.log(`📊 Resultados de promedios para estudiante ${studentId}, fase ${phase}:`, 
                JSON.stringify(phaseAverages, null, 2));

    if (phaseAverages.length > 0) {
      const { average_score, evaluations_count, evaluation_details } = phaseAverages[0];
      
      console.log(`📝 Actualizando phase_averages para estudiante ${studentId}, fase ${phase}:`);
      console.log(`   - Promedio: ${average_score}`);
      console.log(`   - Cantidad de evaluaciones: ${evaluations_count}`);
      console.log(`   - Detalles de evaluaciones: ${evaluation_details}`);
      
      // Actualizar o insertar en phase_averages
      const [result] = await connection.query(
        `INSERT INTO phase_averages 
           (student_id, teacher_id, phase, average_score, evaluations_completed, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
           average_score = VALUES(average_score),
           evaluations_completed = VALUES(evaluations_completed),
           updated_at = NOW()
         RETURNING *`,
        [studentId, teacherId, phase, average_score, evaluations_count]
      );
      
      console.log(`✅ Promedio de fase ${phase} actualizado para el estudiante ${studentId}:`, 
                 JSON.stringify(result, null, 2));
      
      // Verificar que se actualizó correctamente
      const [verification] = await connection.query(
        'SELECT * FROM phase_averages WHERE student_id = ? AND phase = ?',
        [studentId, phase]
      );
      
      console.log(`🔍 Verificación de phase_averages para estudiante ${studentId}, fase ${phase}:`,
                 JSON.stringify(verification, null, 2));
      
      return result;
    } else {
      console.log(`ℹ️ No se encontraron evaluaciones para el estudiante ${studentId}, fase ${phase}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error al actualizar promedios para estudiante ${studentId}, fase ${phase}:`, error);
    throw error;
  }
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
    console.log('🔍 Iniciando actualización de resultado ID:', id);
    console.log('📝 Datos recibidos en el body:', JSON.stringify(req.body, null, 2));
    console.log('👤 Usuario autenticado - ID:', userId, 'Rol:', userRole, 'Teacher ID:', teacherId);
    
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
    const updatedResult = await withTransaction(async (connection) => {
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
      
      const questionnairePhase = updates.questionnaire?.phase !== undefined ? 
                              updates.questionnaire.phase : 
                              questionnaire[0].phase;
      
      const phaseField = `phase_${questionnairePhase}_score`;
      
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
          phase: questionnairePhase // Usar questionnairePhase en lugar de phase
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
          [student_id, questionnairePhase]
        );
        
        const phaseAverageScore = parseFloat(phaseAveragesResult[0]?.avg_score || 0);
        const phaseEvaluationsCount = parseInt(phaseAveragesResult[0]?.count || 0);
        
        console.log(`Promedio calculado para fase ${questionnairePhase}: ${phaseAverageScore} (${phaseEvaluationsCount} evaluaciones)`);
        
        // Actualizar o insertar en phase_averages
        await connection.query(
          `INSERT INTO phase_averages (student_id, teacher_id, phase, average_score, evaluations_completed)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             average_score = VALUES(average_score),
             evaluations_completed = VALUES(evaluations_completed)`,
          [student_id, teacherId, questionnairePhase, phaseAverageScore, phaseEvaluationsCount]
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
          console.log(`Actualizando intento ${attempt.id} con puntaje:`, attempt.score, 'is_selected:', attempt.is_selected);
          await connection.query(
            'UPDATE quiz_attempts SET score = ?, is_selected = ? WHERE id = ?',
            [parseFloat(attempt.score), attempt.is_selected || 0, attempt.id]
          );
        }
        
        // Actualizar min_score y best_score en evaluation_results basado en los intentos
        const [updatedAttempts] = await connection.query(
          'SELECT * FROM quiz_attempts WHERE student_id = ? AND questionnaire_id = ?',
          [result.student_id, result.questionnaire_id]
        );
        
        if (updatedAttempts.length > 0) {
          const scores = updatedAttempts.map(a => parseFloat(a.score || 0));
          const minScore = Math.min(...scores);
          const maxScore = Math.max(...scores);
          
          console.log('Actualizando evaluación con min_score:', minScore, 'y best_score:', maxScore);
          
          await connection.query(
            'UPDATE evaluation_results SET min_score = ?, best_score = ? WHERE id = ?',
            [minScore, maxScore, id]
          );
          
          // Actualizar is_selected en los intentos
          for (const attempt of updatedAttempts) {
            const isBest = parseFloat(attempt.score) === maxScore;
            const isWorst = parseFloat(attempt.score) === minScore && maxScore !== minScore;
            
            if (isBest || isWorst) {
              await connection.query(
                'UPDATE quiz_attempts SET is_selected = ? WHERE id = ?',
                [isBest ? 1 : 0, attempt.id]
              );
            }
          }
        }
      }
      
      // 6. Obtener todos los intentos actualizados ordenados por score (mayor a menor)
      const [allAttempts] = await connection.query(
        `SELECT * FROM quiz_attempts 
         WHERE student_id = ? AND questionnaire_id = ? 
         ORDER BY score DESC, attempt_number ASC`,
        [result.student_id, result.questionnaire_id]
      );
      
      console.log('Intentos actualizados (ordenados por score):', allAttempts);
      
      // Asegurarse de que al menos hay un intento
      if (allAttempts.length > 0) {
        // Obtener el mejor y peor intento
        const bestAttempt = allAttempts[0]; // El primero es el mejor (mayor score)
        const worstAttempt = allAttempts[allAttempts.length - 1]; // El último es el peor (menor score)
        
        const bestScore = parseFloat(bestAttempt.score || 0);
        const minScore = parseFloat(worstAttempt.score || 0);
        
        console.log('Mejor nota:', bestScore, '(Intento:', bestAttempt.attempt_number + ')');
        console.log('Peor nota:', minScore, '(Intento:', worstAttempt.attempt_number + ')');
        
        // Marcar los intentos como seleccionados (1 para el mejor, 0 para el peor si es diferente)
        await connection.query(
          'UPDATE quiz_attempts SET is_selected = 1 WHERE id = ?',
          [bestAttempt.id]
        );
        
        if (bestAttempt.id !== worstAttempt.id) {
          await connection.query(
            'UPDATE quiz_attempts SET is_selected = 0 WHERE id = ?',
            [worstAttempt.id]
          );
        }
        
        // Actualizar evaluation_results con los valores correctos
        await connection.query(
          'UPDATE evaluation_results SET best_score = ?, min_score = ? WHERE id = ?',
          [bestScore, minScore, id]
        );
        
        // Actualizar el objeto de resultado para la respuesta
        result.best_score = bestScore;
        result.min_score = minScore;
      }
      
      // 7. Actualizar la nota en quiz_attempts y evaluation_results
      console.log('🔄 Procesando actualización de notas...');
      console.log('📤 Actualizaciones recibidas:', JSON.stringify(updates.result, null, 2));
      
      if (updates.result && (updates.result.best_score !== undefined || updates.result.min_score !== undefined)) {
        // Obtener los nuevos valores, asegurando que sean números válidos
        const newBestScore = updates.result.best_score !== undefined ? parseFloat(updates.result.best_score) : null;
        const newMinScore = updates.result.min_score !== undefined ? parseFloat(updates.result.min_score) : null;
        
        console.log('🔢 Valores a actualizar - Mejor nota:', newBestScore, 'Peor nota:', newMinScore);
        console.log('🔄 Actualizando notas - Mejor:', newBestScore, 'Mínima:', newMinScore);

        // 1. Obtener todos los intentos actuales
        console.log('🔍 Obteniendo intentos actuales para student_id:', result.student_id, 'y questionnaire_id:', result.questionnaire_id);
        const [currentAttempts] = await connection.query(
          'SELECT * FROM quiz_attempts WHERE student_id = ? AND questionnaire_id = ?',
          [result.student_id, result.questionnaire_id]
        );
        console.log('📊 Intentos actuales encontrados:', JSON.stringify(currentAttempts, null, 2));
        
        // 2. Actualizar o crear intentos
        if (currentAttempts.length >= 2) {
          // Actualizar los dos intentos existentes
          const bestAttempt = currentAttempts.find(a => a.is_selected === 1) || currentAttempts[0];
          const worstAttempt = currentAttempts.find(a => a.is_selected === 0) || currentAttempts[1];
          
          console.log('🔄 Actualizando intento de mejor nota (ID:', bestAttempt.id, ') con:', newBestScore);
          await connection.query(
            'UPDATE quiz_attempts SET score = ?, is_selected = 1, updated_at = NOW() WHERE id = ?',
            [newBestScore, bestAttempt.id]
          );
          
          console.log('🔄 Actualizando intento de peor nota (ID:', worstAttempt.id, ') con:', newMinScore);
          await connection.query(
            'UPDATE quiz_attempts SET score = ?, is_selected = 0, updated_at = NOW() WHERE id = ?',
            [newMinScore, worstAttempt.id]
          );
        } else if (currentAttempts.length === 1) {
          // Actualizar el primer intento y crear el segundo
          console.log('🔄 Actualizando primer intento (ID:', currentAttempts[0].id, ') con mejor nota:', newBestScore);
          await connection.query(
            'UPDATE quiz_attempts SET score = ?, is_selected = 1, updated_at = NOW() WHERE id = ?',
            [newBestScore, currentAttempts[0].id]
          );
          
          console.log('➕ Creando segundo intento con peor nota:', newMinScore);
          await connection.query(
            'INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score, phase, is_selected, created_at, updated_at) ' +
            'VALUES (?, ?, 2, ?, ?, 0, NOW(), NOW())',
            [result.student_id, result.questionnaire_id, newMinScore, result.phase || 1]
          );
        } else {
          // Crear ambos intentos si no existen
          console.log('➕ Creando primer intento con mejor nota:', newBestScore);
          await connection.query(
            'INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score, phase, is_selected, created_at, updated_at) ' +
            'VALUES (?, ?, 1, ?, ?, 1, NOW(), NOW())',
            [result.student_id, result.questionnaire_id, newBestScore, result.phase || 1]
          );
          
          console.log('➕ Creando segundo intento con peor nota:', newMinScore);
          await connection.query(
            'INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score, phase, is_selected, created_at, updated_at) ' +
            'VALUES (?, ?, 2, ?, ?, 0, NOW(), NOW())',
            [result.student_id, result.questionnaire_id, newMinScore, result.phase || 1]
          );
        }

        // 2. Actualizar o crear intentos según sea necesario
        if (newBestScore !== null) {
          // Actualizar o crear el mejor intento
          let bestAttempt = currentAttempts.find(a => a.is_selected === 1);
          
          if (!bestAttempt && currentAttempts.length > 0) {
            bestAttempt = currentAttempts.reduce((prev, current) => 
              parseFloat(prev.score) > parseFloat(current.score) ? prev : current
            );
          }

          if (bestAttempt) {
            console.log(`📝 Actualizando mejor intento ${bestAttempt.id} con nota: ${newBestScore}`);
            await connection.query(
              'UPDATE quiz_attempts SET score = ? WHERE id = ?',
              [newBestScore, bestAttempt.id]
            );
          } else {
            console.log('➕ Creando nuevo intento con mejor nota:', newBestScore);
            await connection.query(
              'INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score, phase, is_selected) VALUES (?, ?, 1, ?, ?, 1)',
              [result.student_id, result.questionnaire_id, newBestScore, result.phase || 1]
            );
          }
        }

        if (newMinScore !== null) {
          // Actualizar o crear el peor intento
          let minAttempt = currentAttempts.find(a => a.is_selected === 0);
          
          if (!minAttempt && currentAttempts.length > 0) {
            minAttempt = currentAttempts.reduce((prev, current) => 
              parseFloat(prev.score) < parseFloat(current.score) ? prev : current
            );
          }

          if (minAttempt) {
            console.log(`📝 Actualizando peor intento ${minAttempt.id} con nota: ${newMinScore}`);
            await connection.query(
              'UPDATE quiz_attempts SET score = ? WHERE id = ?',
              [newMinScore, minAttempt.id]
            );
          } else {
            console.log('➕ Creando nuevo intento con peor nota:', newMinScore);
            await connection.query(
              'INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score, phase, is_selected) VALUES (?, ?, 2, ?, ?, 0)',
              [result.student_id, result.questionnaire_id, newMinScore, result.phase || 1]
            );
          }
        }

        // 3. Obtener todos los intentos actualizados
        console.log('🔄 Obteniendo intentos actualizados...');
        const [updatedAttempts] = await connection.query(
          'SELECT * FROM quiz_attempts WHERE student_id = ? AND questionnaire_id = ? ORDER BY is_selected DESC, score DESC',
          [result.student_id, result.questionnaire_id]
        );
        console.log('✅ Intentos actualizados:', JSON.stringify(updatedAttempts, null, 2));

        // 4. Obtener las puntuaciones actualizadas
        const bestScore = updatedAttempts.length > 0 ? parseFloat(updatedAttempts[0].score) : 0;
        const minScore = updatedAttempts.length > 1 ? parseFloat(updatedAttempts[1].score) : bestScore;
        
        console.log('📊 Puntuaciones finales - Mejor:', bestScore, 'Mínima:', minScore);

        // 5. Actualizar evaluation_results con los valores exactos
        console.log('📝 Actualizando evaluation_results con best_score:', bestScore, 'y min_score:', minScore);
        await connection.query(
          'UPDATE evaluation_results SET best_score = ?, min_score = ?, updated_at = NOW() WHERE id = ?',
          [bestScore, minScore, id]
        );
        
        // 6. Actualizar o crear registro en la tabla grades
        const phase = result.phase || 1;
        console.log('📊 Actualizando tabla grades para student_id:', result.student_id, 
                   'teacher_id:', teacherId, 'phase:', phase, 'con nota:', bestScore);
                   
        await connection.query(`
          INSERT INTO grades (student_id, teacher_id, phase, grade, created_at, updated_at)
          VALUES (?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE 
            grade = VALUES(grade),
            updated_at = NOW()
        `, [result.student_id, teacherId, phase, bestScore]);
        
        // 7. Actualizar promedios de fase
        console.log('🔄 Actualizando promedios de fase...');
        await updatePhaseAverages(connection, result.student_id, teacherId, phase);

        // Actualizar el objeto de retorno con los valores finales
        if (!updates.result) updates.result = {};
        const finalBestScore = bestScore !== null ? bestScore : (result.best_score || 0);
        const finalMinScore = minScore !== null ? minScore : (result.min_score || 0);
        
        updates.result.best_score = finalBestScore;
        updates.result.min_score = finalMinScore;
        updates.result.worst_score = finalMinScore; // Asegurar que worst_score también se actualice
        
        console.log(`✅ Notas finales - Mejor: ${finalBestScore}, Mínima: ${finalMinScore}`);
        
        console.log(`✅ Proceso completado. Notas actualizadas - Mejor: ${bestScore}, Mínima: ${minScore}`);
      }
      
      // 8. Actualizar promedios de fase
      const phaseToUpdate = updates.questionnaire?.phase || result.phase;
      if (phaseToUpdate) {
        console.log(`🔄 Actualizando promedios para fase: ${phaseToUpdate}`);
        await updatePhaseAverages(connection, result.student_id, teacherId, phaseToUpdate);
      }
      
      if (updates.result || updates.questionnaire?.phase) {
        const resultUpdates = { ...updates.result || {} };
        const phaseNumber = updates.questionnaire?.phase || result.phase;
        
        // Asegurarse de que los valores numéricos se guarden correctamente
        if (resultUpdates.best_score !== undefined) {
          resultUpdates.best_score = parseFloat(resultUpdates.best_score) || 0;
          console.log(`Actualizando best_score a: ${resultUpdates.best_score}`);
        }
        
        if (resultUpdates.worst_score !== undefined) {
          resultUpdates.worst_score = parseFloat(resultUpdates.worst_score) || 0;
          console.log(`Actualizando worst_score a: ${resultUpdates.worst_score}`);
        }
        
        // Actualizar los campos en la base de datos
        if (Object.keys(resultUpdates).length > 0) {
          console.log('Actualizando evaluation_results con:', resultUpdates);
          
          // Primero actualizamos los campos en la base de datos
          await connection.query(
            'UPDATE evaluation_results SET ? WHERE id = ?',
            [resultUpdates, id]
          );
          
          // Luego obtenemos los valores actualizados para asegurar consistencia
          const [updatedResult] = await connection.query(
            'SELECT * FROM evaluation_results WHERE id = ?',
            [id]
          );
          
          if (updatedResult && updatedResult.length > 0) {
            // Actualizamos los valores en el objeto de retorno
            updates.result = {
              ...updates.result,
              best_score: updatedResult[0].best_score,
              worst_score: updatedResult[0].worst_score
            };
            console.log('Datos actualizados en la base de datos:', updatedResult[0]);
          }
          
          // Si hay cambios en best_score o worst_score, actualizar la tabla grades
          if (resultUpdates.best_score !== undefined || resultUpdates.worst_score !== undefined) {
            const phaseNumber = updates.questionnaire?.phase || result.phase || 1;
            
            // Obtener todas las mejores notas de evaluaciones en esta fase
            const [phaseEvaluations] = await connection.query(
              `SELECT er.best_score 
               FROM evaluation_results er
               JOIN questionnaires q ON er.questionnaire_id = q.id
               WHERE er.student_id = ? AND q.phase = ?`,
              [result.student_id, phaseNumber]
            );
            
            // Calcular el promedio de todas las evaluaciones de esta fase
            let phaseAverage = 0;
            if (phaseEvaluations.length > 0) {
              const sum = phaseEvaluations.reduce((total, item) => total + parseFloat(item.best_score || 0), 0);
              phaseAverage = parseFloat((sum / phaseEvaluations.length).toFixed(2));
            }
            
            console.log(`Promedio de la fase ${phaseNumber} calculado:`, phaseAverage);
            
            // Verificar si el promedio es NaN y convertirlo a NULL para MySQL
            const phaseAverageForDB = isNaN(phaseAverage) ? null : phaseAverage;
            
            // Actualizar la columna de la fase correspondiente en la tabla grades
            const phaseField = `phase${phaseNumber}`;
            
            // Verificar si ya existe un registro en grades para este estudiante
            const [existingGrade] = await connection.query(
              'SELECT * FROM grades WHERE student_id = ?',
              [result.student_id]
            );
              
              if (existingGrade && existingGrade.length > 0) {
                // Actualizar el registro existente
                await connection.query(
                  `UPDATE grades SET ${phaseField} = ? WHERE student_id = ?`,
                  [phaseAverageForDB, result.student_id]
                );
                console.log(`Actualizado ${phaseField} para el estudiante ${result.student_id} con promedio ${phaseAverageForDB}`);
                
                // Actualizar el promedio general
                await connection.query(
                  'UPDATE grades SET average = (phase1 + phase2 + phase3 + phase4) / 4 WHERE student_id = ?',
                  [result.student_id]
                );
              } else {
                // Crear nuevo registro
                const gradeData = {
                  student_id: result.student_id,
                  phase: questionnairePhase, // Usar questionnairePhase en lugar de phaseField
                  [phaseField]: phaseAverageForDB,
                  average: phaseAverageForDB
                };
                
                await connection.query('INSERT INTO grades SET ?', [gradeData]);
                console.log('Creado nuevo registro en grades:', gradeData);
              }
              
              // Actualizar phase_averages con el phaseNumber correcto
              await updatePhaseAverages(connection, result.student_id, teacherId, phaseNumber);
            }
          }
        }
      
      // Obtener el resultado actualizado con todos los intentos
      console.log('🔍 Obteniendo datos actualizados para el resultado ID:', id);
      
      // Consulta detallada para verificar los cambios
      console.log('🔎 Consultando datos actualizados...');
      const [verification] = await connection.query(`
        SELECT er.*, 
               (SELECT score FROM quiz_attempts 
                WHERE student_id = er.student_id AND questionnaire_id = er.questionnaire_id 
                AND is_selected = 1 LIMIT 1) as best_attempt,
               (SELECT score FROM quiz_attempts 
                WHERE student_id = er.student_id AND questionnaire_id = er.questionnaire_id 
                AND is_selected = 0 LIMIT 1) as min_attempt,
               (SELECT grade FROM grades 
                WHERE student_id = er.student_id AND phase = ? LIMIT 1) as current_grade,
               (SELECT average_score FROM phase_averages 
                WHERE student_id = er.student_id AND phase = ? LIMIT 1) as phase_average
        FROM evaluation_results er
        WHERE er.id = ?
      `, [result.phase || 1, result.phase || 1, id]);
      
      console.log('✅ Verificación de datos actualizados:', JSON.stringify(verification[0], null, 2));
      
      // Consulta optimizada para obtener los datos del resultado de evaluación
      const query = `
        SELECT 
          er.*,
          s.id as student_id,
          s.user_id as student_user_id,
          s.grade as student_grade,
          s.contact_phone,
          s.contact_email,
          s.age,
          q.id as questionnaire_id,
          q.title as questionnaire_title,
          q.description as questionnaire_description,
          q.phase as questionnaire_phase,
          q.created_by as teacher_id,
          t.user_id as teacher_user_id,
          t.subject as teacher_subject,
          us.name as student_name,
          us.email as student_email,
          us.phone as student_phone,
          u.name as teacher_name,
          u.email as teacher_email,
          u.phone as teacher_phone,
          c.id as course_id,
          c.name as course_name,
          c.grade as course_grade
        FROM evaluation_results er
        INNER JOIN students s ON er.student_id = s.id
        INNER JOIN users us ON s.user_id = us.id
        INNER JOIN questionnaires q ON er.questionnaire_id = q.id
        INNER JOIN teachers t ON q.created_by = t.id
        INNER JOIN users u ON t.user_id = u.id
        LEFT JOIN courses c ON s.course_id = c.id
        WHERE er.id = ?
      `;
      
      console.log('Ejecutando consulta SQL para obtener resultado actualizado:', query);
      const [fullResult] = await connection.query(query, [id]);
      console.log('Resultado de la consulta:', fullResult);
      
      if (fullResult.length === 0) {
        throw new Error('No se pudo recuperar el resultado actualizado');
      }
      
      // Obtener los intentos del cuestionario para este estudiante
      const [attempts] = await connection.query(
        `SELECT 
          id, 
          attempt_number, 
          score as attempt_score,
          attempt_date,
          CASE WHEN id = ? THEN 1 ELSE 0 END as is_selected
        FROM quiz_attempts 
        WHERE student_id = ? AND questionnaire_id = ?
        ORDER BY attempt_number`,
        [fullResult[0].selected_attempt_id, fullResult[0].student_id, fullResult[0].questionnaire_id]);
      
      if (!attempts || !Array.isArray(attempts)) {
        throw new Error('No se pudieron recuperar los intentos del cuestionario');
      }
      
      console.log('Intentos obtenidos de la base de datos:', attempts);
      
      // Construir el objeto de respuesta con los datos ya obtenidos
      const resultWithAttempts = {
        ...fullResult[0],
        attempts: attempts || [],
        student: {
          id: fullResult[0].student_id,
          user_id: fullResult[0].student_user_id,
          name: fullResult[0].student_name,
          email: fullResult[0].student_email,
          grade: fullResult[0].student_grade
        },
        questionnaire: {
          id: fullResult[0].questionnaire_id,
          title: fullResult[0].questionnaire_title,
          description: fullResult[0].questionnaire_description,
          phase: fullResult[0].questionnaire_phase,
          created_by: {
            id: fullResult[0].created_by_teacher_id,
            user_id: fullResult[0].teacher_user_id,
            name: fullResult[0].teacher_name,
            email: fullResult[0].teacher_email
          }
        },
        course: fullResult[0].course_id ? {
          id: fullResult[0].course_id,
          name: fullResult[0].course_name,
          grade: fullResult[0].course_grade,
          section: fullResult[0].course_section
        } : null
      };

      // Devolver los datos actualizados completos
      return resultWithAttempts;
    });

    // Obtener los intentos actualizados para la respuesta
    const [attempts] = await db.query(
      'SELECT id, attempt_number, score, is_selected FROM quiz_attempts WHERE student_id = ? AND questionnaire_id = ? ORDER BY attempt_number ASC',
      [updatedResult.student_id, updatedResult.questionnaire_id]
    );
    
    // Encontrar el mejor y peor intento basado en el puntaje
    let bestAttempt = null;
    let worstAttempt = null;
    
    if (attempts.length > 0) {
      // Ordenar por puntuación para encontrar mejor y peor
      const sortedByScore = [...attempts].sort((a, b) => b.score - a.score);
      bestAttempt = sortedByScore[0];
      worstAttempt = sortedByScore[sortedByScore.length - 1];
      
      // Si solo hay un intento, es tanto el mejor como el peor
      if (attempts.length === 1) {
        worstAttempt = bestAttempt;
      }
    }
    
    // Construir el objeto de respuesta con toda la información necesaria
    const responseData = {
      ...updatedResult,
      all_attempts: attempts, // Incluir todos los intentos
      best_attempt: bestAttempt ? {
        id: bestAttempt.id,
        attempt_number: bestAttempt.attempt_number,
        score: parseFloat(bestAttempt.score)
      } : null,
      worst_attempt: worstAttempt && worstAttempt !== bestAttempt ? {
        id: worstAttempt.id,
        attempt_number: worstAttempt.attempt_number,
        score: parseFloat(worstAttempt.score)
      } : null,
      best_score: bestAttempt ? parseFloat(bestAttempt.score) : null,
      worst_score: worstAttempt ? parseFloat(worstAttempt.score) : null,
      total_attempts: attempts.length
    };
    
    console.log('Enviando respuesta al frontend:', JSON.stringify(responseData, null, 2));
    
    // Si llegamos aquí, la transacción fue exitosa
    res.json({
      success: true,
      message: 'Resultado actualizado exitosamente',
      data: responseData
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
    
    // Obtener todos los intentos para calcular min y max score
    const [allAttempts] = await db.query(
      'SELECT * FROM quiz_attempts WHERE student_id = ? AND questionnaire_id = ?',
      [result.student_id, result.questionnaire_id]
    );
    
    // Calcular min y max score
    if (allAttempts.length > 0) {
      const scores = allAttempts.map(a => parseFloat(a.score || 0));
      result.min_score = Math.min(...scores);
      result.max_score = Math.max(...scores);
    } else {
      // Si no hay intentos, usar el score actual o 0
      const currentScore = parseFloat(result.score || 0);
      result.min_score = currentScore;
      result.max_score = currentScore;
    }
    
    // Asegurar que best_score esté definido
    result.best_score = result.best_score || result.max_score || 0;
    
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

// Ruta de diagnóstico para verificar el estado de las tablas
router.get('/diagnostic/:studentId/:questionnaireId', async (req, res) => {
  const { studentId, questionnaireId } = req.params;
  
  try {
    // 1. Obtener información del estudiante
    const [student] = await db.query('SELECT * FROM students WHERE id = ?', [studentId]);
    
    // 2. Obtener información del cuestionario
    const [questionnaire] = await db.query('SELECT * FROM questionnaires WHERE id = ?', [questionnaireId]);
    
    // 3. Obtener todos los intentos del estudiante para este cuestionario
    const [attempts] = await db.query(
      'SELECT * FROM quiz_attempts WHERE student_id = ? AND questionnaire_id = ?',
      [studentId, questionnaireId]
    );
    
    // 4. Obtener el resultado de evaluación
    const [evaluation] = await db.query(
      'SELECT * FROM evaluation_results WHERE student_id = ? AND questionnaire_id = ?',
      [studentId, questionnaireId]
    );
    
    // 5. Obtener promedios de fase
    const phase = questionnaire.length > 0 ? questionnaire[0].phase : null;
    let phaseAverages = [];
    
    if (phase) {
      [phaseAverages] = await db.query(
        'SELECT * FROM phase_averages WHERE student_id = ? AND phase = ?',
        [studentId, phase]
      );
    }
    
    // 6. Obtener calificaciones
    let grades = [];
    if (phase) {
      [grades] = await db.query(
        'SELECT * FROM grades WHERE student_id = ? AND phase = ?',
        [studentId, phase]
      );
    }
    
    // 7. Obtener todas las evaluaciones del estudiante en esta fase
    let allPhaseEvaluations = [];
    if (phase) {
      [allPhaseEvaluations] = await db.query(
        `SELECT er.*, q.title as questionnaire_title, q.phase 
         FROM evaluation_results er
         JOIN questionnaires q ON er.questionnaire_id = q.id
         WHERE er.student_id = ? AND q.phase = ?`,
        [studentId, phase]
      );
    }
    
    res.json({
      success: true,
      data: {
        student: student[0] || null,
        questionnaire: questionnaire[0] || null,
        attempts,
        evaluation: evaluation[0] || null,
        phaseAverages: phaseAverages[0] || null,
        grades: grades[0] || null,
        allPhaseEvaluations,
        phase
      }
    });
    
  } catch (error) {
    console.error('Error en diagnóstico:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información de diagnóstico',
      error: error.message
    });
  }
});

export default router;
