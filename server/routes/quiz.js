// routes/quiz.js
import express from 'express';
import pool from '../config/db.js';  // tu conexión MySQL
import { verifyToken } from '../middleware/authMiddleware.js';
const router = express.Router();

router.post('/submit', verifyToken, async (req, res) => {
  const { student_id, questionnaire_id, answers, session_id } = req.body;

  try {
    // Usar el usuario autenticado para evitar suplantación
    const authenticatedUserId = req.user?.id;
    const userIdForStudentLookup = authenticatedUserId || student_id;

    // Primero, obtener el ID del estudiante a partir del ID de usuario
    const [studentRows] = await pool.query(
      'SELECT id, grade FROM students WHERE user_id = ?',
      [userIdForStudentLookup]
    );
    
    if (studentRows.length === 0) {
      return res.status(404).json({ 
        message: 'No se encontró un perfil de estudiante para este usuario. Por favor, complete su perfil primero.' 
      });
    }

    const realStudentId = studentRows[0].id;
    
    const answeredQuestionIds = Object.keys(answers || {}).map((k) => parseInt(k, 10)).filter(Boolean);
    if (answeredQuestionIds.length === 0) {
      return res.status(400).json({ message: 'No se recibieron respuestas.' });
    }

    // 1. Obtener solo las preguntas respondidas (y validar que pertenecen al cuestionario)
    const placeholders = answeredQuestionIds.map(() => '?').join(',');
    const [questions] = await pool.query(
      `SELECT id, correct_answer 
       FROM questions 
       WHERE questionnaire_id = ? AND id IN (${placeholders})`,
      [questionnaire_id, ...answeredQuestionIds]
    );

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado o sin preguntas válidas.' });
    }

    // 2. Calcular aciertos sobre las preguntas respondidas
    let correctCount = 0;
    for (const question of questions) {
      const studentAnswer = answers[question.id];
      if (studentAnswer && studentAnswer === question.correct_answer) {
        correctCount++;
      }
    }

    const totalQuestions = questions.length;
    // Nota: el denominador final se define más abajo (según questions_to_answer)

    // 6. Obtener la fase del cuestionario, límites y tiempo
    const [questionnaireInfo] = await pool.query(
      'SELECT phase, created_by, grade, questions_to_answer, time_limit_minutes FROM questionnaires WHERE id = ?',
      [questionnaire_id]
    );

    if (questionnaireInfo.length === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado.' });
    }

    const phaseNumber = questionnaireInfo[0].phase;
    const teacherId = questionnaireInfo[0].created_by;
    const questionnaireGrade = questionnaireInfo[0].grade;
    const questionsToAnswer = questionnaireInfo[0].questions_to_answer;
    const timeLimitMinutes = questionnaireInfo[0].time_limit_minutes;

    // En cuestionarios con límite de tiempo o selección aleatoria, exigir sesión
    const needsSession = Boolean(timeLimitMinutes || questionsToAnswer);
    let session = null;

    if (needsSession) {
      // Buscar la sesión activa
      if (session_id) {
        const [sessions] = await pool.query(
          `SELECT * FROM quiz_sessions 
           WHERE id = ? AND student_id = ? AND questionnaire_id = ? AND status = 'in_progress'`,
          [session_id, realStudentId, questionnaire_id]
        );
        session = sessions[0] || null;
      } else {
        const [sessions] = await pool.query(
          `SELECT * FROM quiz_sessions 
           WHERE student_id = ? AND questionnaire_id = ? AND status = 'in_progress'
           ORDER BY started_at DESC
           LIMIT 1`,
          [realStudentId, questionnaire_id]
        );
        session = sessions[0] || null;
      }

      if (!session) {
        return res.status(400).json({
          message: 'No hay una sesión activa para esta evaluación. Por favor inicia la evaluación nuevamente.',
          code: 'NO_ACTIVE_SESSION'
        });
      }

      // Validar expiración en backend
      if (session.expires_at && new Date() > new Date(session.expires_at)) {
        await pool.query(`UPDATE quiz_sessions SET status = 'expired' WHERE id = ?`, [session.id]);
        return res.status(400).json({
          message: 'Se agotó el tiempo de la evaluación.',
          code: 'TIME_EXPIRED'
        });
      }

      // Validar que las preguntas respondidas pertenezcan a la sesión
      let sessionQuestionIds = [];
      try {
        sessionQuestionIds = JSON.parse(session.question_ids_json || '[]');
      } catch (e) {
        sessionQuestionIds = [];
      }

      const answeredSet = new Set(answeredQuestionIds);
      const sessionSet = new Set(sessionQuestionIds.map((n) => parseInt(n, 10)).filter(Boolean));
      for (const qid of answeredSet) {
        if (!sessionSet.has(qid)) {
          return res.status(400).json({
            message: 'Se detectaron respuestas a preguntas que no pertenecen a esta sesión.',
            code: 'INVALID_QUESTION_SET'
          });
        }
      }
    }

    // Si el docente configuró un número de preguntas a responder:
    // - si hay menos preguntas disponibles en BD que el límite, el "límite efectivo" será el total disponible
    // - el estudiante debe responder exactamente ese límite efectivo
    let effectiveTotalQuestions = totalQuestions;
    if (questionsToAnswer) {
      const [countRows] = await pool.query(
        'SELECT COUNT(*) AS total_available FROM questions WHERE questionnaire_id = ?',
        [questionnaire_id]
      );
      const totalAvailable = countRows?.[0]?.total_available ? parseInt(countRows[0].total_available, 10) : 0;
      const effectiveLimit = Math.min(parseInt(questionsToAnswer, 10), totalAvailable || parseInt(questionsToAnswer, 10));
      effectiveTotalQuestions = effectiveLimit;

      if (totalQuestions !== effectiveLimit) {
        return res.status(400).json({
          message: `Debes responder exactamente ${effectiveLimit} preguntas para esta evaluación.`,
          required: effectiveLimit,
          answered: totalQuestions,
          total_available: totalAvailable
        });
      }
    }

    const score = parseFloat(((correctCount / effectiveTotalQuestions) * 5).toFixed(2));
    const percentage = parseFloat(((correctCount / effectiveTotalQuestions) * 100).toFixed(2));

    // Obtener el año académico actual
    const currentAcademicYear = new Date().getFullYear();

    // Definir attempt_number: si hay sesión, usar su attempt_number. Si no, calcularlo por intentos previos.
    let attemptNumber = null;
    if (session?.attempt_number) {
      attemptNumber = parseInt(session.attempt_number, 10);
    } else {
      const [attempts] = await pool.query(
        `SELECT COUNT(*) AS count FROM quiz_attempts 
         WHERE student_id = ? AND questionnaire_id = ? AND (academic_year = ? OR academic_year IS NULL)`,
        [realStudentId, questionnaire_id, currentAcademicYear]
      );
      attemptNumber = (attempts?.[0]?.count || 0) + 1;
    }

    // Mantener el límite de 2 intentos por evaluación
    if (attemptNumber > 2) {
      return res.status(400).json({ message: 'Ya has realizado los 2 intentos permitidos.' });
    }

    // 4. Insertar intento con el ID de estudiante correcto, la fase y el año académico
    const [result] = await pool.query(
      `INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score, phase, academic_year)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [realStudentId, questionnaire_id, attemptNumber, score, phaseNumber, currentAcademicYear]
    );

    const attemptId = result.insertId;

    // Marcar sesión como enviada (si existe) y guardar respuestas
    if (session?.id) {
      await pool.query(
        `UPDATE quiz_sessions 
         SET status = 'submitted', answers_json = ?
         WHERE id = ?`,
        [JSON.stringify(answers || {}), session.id]
      );
    }

    // 5. Verificar si actualizar o crear en evaluation_results (filtrar por academic_year también)
    const [existingEval] = await pool.query(
      `SELECT id, best_score, selected_attempt_id FROM evaluation_results 
       WHERE student_id = ? AND questionnaire_id = ? 
       AND (academic_year = ? OR academic_year IS NULL)`,
      [realStudentId, questionnaire_id, currentAcademicYear]
    );

    if (existingEval.length === 0) {
      // Nuevo resultado
      await pool.query(
        `INSERT INTO evaluation_results (student_id, questionnaire_id, best_score, selected_attempt_id, phase, academic_year)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [realStudentId, questionnaire_id, score, attemptId, phaseNumber, currentAcademicYear]
      );
    } else {
      const current = existingEval[0];
      if (score > current.best_score) {
        // Actualizar si esta nota es mejor; también phase para mantener coherencia con questionnaire
        await pool.query(
          `UPDATE evaluation_results 
           SET best_score = ?, selected_attempt_id = ?, phase = ?, recorded_at = CURRENT_TIMESTAMP, 
               academic_year = COALESCE(academic_year, ?)
           WHERE id = ?`,
          [score, attemptId, phaseNumber, currentAcademicYear, current.id]
        );
      } else {
        // Mismo o menor puntaje: seguir sincronizando phase por si el cuestionario cambió de fase
        await pool.query(
          `UPDATE evaluation_results SET phase = ?, academic_year = COALESCE(academic_year, ?) WHERE id = ?`,
          [phaseNumber, currentAcademicYear, current.id]
        );
      }
    }

    // MODIFICACIÓN PRINCIPAL: Calcular el promedio de todas las mejores notas de la fase
    // EXCLUIR cuestionarios tipo Prueba Saber del cálculo de promedios
    // Obtener todas las mejores notas de evaluaciones en esta fase (filtradas por academic_year)
    // IMPORTANTE: Excluir cuestionarios tipo Prueba Saber (is_prueba_saber = FALSE o NULL)
    const [phaseEvaluations] = await pool.query(
      `SELECT er.best_score 
       FROM evaluation_results er
       JOIN questionnaires q ON er.questionnaire_id = q.id
       WHERE er.student_id = ? 
         AND q.phase = ? 
         AND (er.academic_year = ? OR er.academic_year IS NULL)
         AND (q.is_prueba_saber = FALSE OR q.is_prueba_saber IS NULL)`,
      [realStudentId, phaseNumber, currentAcademicYear]
    );
    
    // Calcular el promedio de todas las evaluaciones de esta fase
    let phaseAverage = 0;
    if (phaseEvaluations.length > 0) {
      const sum = phaseEvaluations.reduce((total, item) => total + item.best_score, 0);
      phaseAverage = parseFloat((sum / phaseEvaluations.length).toFixed(2));
    }
    
    // Verificar si el promedio es NaN y convertirlo a NULL para MySQL
    const phaseAverageForDB = isNaN(phaseAverage) ? null : phaseAverage;
    
    // Actualizar la columna de la fase correspondiente en la tabla grades
    const phaseColumn = `phase${phaseNumber}`;
    
    // Verificar si ya existe un registro para este estudiante (filtrar por academic_year)
    const [existingGrade] = await pool.query(
      'SELECT * FROM grades WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)',
      [realStudentId, currentAcademicYear]
    );
    
    if (existingGrade.length === 0) {
      // Crear nuevo registro en grades incluyendo questionnaire_id y academic_year
      await pool.query(
        `INSERT INTO grades (student_id, questionnaire_id, ${phaseColumn}, created_at, academic_year) 
         VALUES (?, ?, ?, NOW(), ?)`,
        [realStudentId, questionnaire_id, phaseAverageForDB, currentAcademicYear]
      );
    } else {
      // Actualizar registro existente (y asegurar que tenga academic_year)
      await pool.query(
        `UPDATE grades SET ${phaseColumn} = ?, academic_year = COALESCE(academic_year, ?) 
         WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)`,
        [phaseAverageForDB, currentAcademicYear, realStudentId, currentAcademicYear]
      );
    }
    
    // Recalcular el promedio general (para el registro del año académico actual)
    await pool.query(
      `UPDATE grades 
       SET average = (COALESCE(phase1, 0) + COALESCE(phase2, 0) + COALESCE(phase3, 0) + COALESCE(phase4, 0)) / 
                    (IF(phase1 IS NULL, 0, 1) + IF(phase2 IS NULL, 0, 1) + IF(phase3 IS NULL, 0, 1) + IF(phase4 IS NULL, 0, 1))
       WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)`,
      [realStudentId, currentAcademicYear]
    );
    
    // Actualizar o crear registro en phase_averages
    try {
      const [existingPhaseAvg] = await pool.query(
        'SELECT * FROM phase_averages WHERE student_id = ? AND teacher_id = ? AND phase = ?',
        [realStudentId, teacherId, phaseNumber]
      );

      if (existingPhaseAvg.length === 0) {
        // Crear nuevo registro
        await pool.query(
          'INSERT INTO phase_averages (student_id, teacher_id, phase, average_score, evaluations_completed) VALUES (?, ?, ?, ?, ?)',
          [realStudentId, teacherId, phaseNumber, phaseAverageForDB, phaseEvaluations.length]
        );
      } else {
        // Actualizar registro existente
        await pool.query(
          'UPDATE phase_averages SET average_score = ?, evaluations_completed = ? WHERE student_id = ? AND teacher_id = ? AND phase = ?',
          [phaseAverageForDB, phaseEvaluations.length, realStudentId, teacherId, phaseNumber]
        );
      }
    } catch (error) {
      console.error('Error al actualizar phase_averages:', error);
      // No interrumpimos el flujo principal si hay un error aquí
    }

    // Verificar si el estudiante ha completado todos los cuestionarios de la fase
    const [totalQuestionnairesByPhase] = await pool.query(`
      SELECT COUNT(*) as total
      FROM questionnaires
      WHERE phase = ? AND grade = ?
    `, [phaseNumber, questionnaireGrade]);

    const [completedQuestionnairesByPhase] = await pool.query(`
      SELECT COUNT(DISTINCT er.questionnaire_id) as completed
      FROM evaluation_results er
      JOIN questionnaires q ON er.questionnaire_id = q.id
      WHERE er.student_id = ? AND q.phase = ? 
      AND (er.academic_year = ? OR er.academic_year IS NULL)
    `, [realStudentId, phaseNumber, currentAcademicYear]);

    // Si ha completado todos los cuestionarios, verificar si necesita plan de mejoramiento
    if (totalQuestionnairesByPhase[0].total > 0 && 
        completedQuestionnairesByPhase[0].completed >= totalQuestionnairesByPhase[0].total) {
      
      console.log(`Estudiante ${realStudentId} ha completado todos los cuestionarios de la fase ${phaseNumber}`);
      
      // Obtener la nota de la fase (filtrar por academic_year)
      const [phaseGrade] = await pool.query(`
        SELECT 
          CASE 
            WHEN ${phaseNumber} = 1 THEN phase1
            WHEN ${phaseNumber} = 2 THEN phase2
            WHEN ${phaseNumber} = 3 THEN phase3
            WHEN ${phaseNumber} = 4 THEN phase4
          END as phase_score
        FROM grades
        WHERE student_id = ? AND (academic_year = ? OR academic_year IS NULL)
      `, [realStudentId, currentAcademicYear]);
      
      // Si la nota es menor a 3.5, generar plan de mejoramiento
      if (phaseGrade.length > 0 && phaseGrade[0].phase_score < 3.5) {
        // Importar y usar la función de generación de planes
        const { generateImprovementPlan } = await import('../services/phaseEvaluationService.js');
        
        // Obtener datos completos del estudiante
        const [studentData] = await pool.query(`
          SELECT 
            s.id as student_id, 
            s.user_id,
            s.grade,
            s.course_id,
            u.name as student_name,
            c.name as course_name,
            g.phase${phaseNumber} as phase_score
          FROM students s
          JOIN users u ON s.user_id = u.id
          LEFT JOIN grades g ON s.id = g.student_id
          LEFT JOIN courses c ON s.course_id = c.id
          WHERE s.id = ?
        `, [realStudentId]);
        
        if (studentData.length > 0) {
          await generateImprovementPlan(studentData[0], phaseNumber);
        }
      }
    }

    res.json({ 
      message: 'Evaluación registrada correctamente.', 
      score,
      percentage,
      correctCount,
      totalQuestions: effectiveTotalQuestions,
      phaseAverage: phaseAverageForDB
    });

  } catch (error) {
    console.error('Error al registrar evaluación:', error);
    res.status(500).json({ message: 'Error al procesar el intento.' });
  }
});

// Obtener todos los intentos de un estudiante para todos los cuestionarios
router.get('/attempts/all/:student_id', async (req, res) => {
  const { student_id } = req.params;
  console.log("student_id: "+student_id);
  try {
    // Primero, obtener el ID del estudiante a partir del ID de usuario
    const [studentRows] = await pool.query(
      'SELECT id FROM students WHERE user_id = ?',
      [student_id]
    );

    if (studentRows.length === 0) {
      console.log(`No se encontró estudiante para el user_id ${student_id}`);
      return res.json({ attempts: [], count: 0 });
    }

    const realStudentId = studentRows[0].id;
    console.log(`User ID ${student_id} corresponde al student_id ${realStudentId}`);

    // Obtener año académico actual para filtrar
    const currentAcademicYear = new Date().getFullYear();
    
    // Consulta para obtener el conteo de intentos por cuestionario (filtrados por academic_year)
    const [rows] = await pool.query(
      `SELECT questionnaire_id, COUNT(*) as attempt_count 
       FROM quiz_attempts 
       WHERE student_id = ? 
       AND (academic_year = ? OR academic_year IS NULL)
       GROUP BY questionnaire_id`,
      [realStudentId, currentAcademicYear]
    );
    
    console.log(`Intentos encontrados para el student_id ${realStudentId}:`, rows);
    res.json({ attempts: rows, count: rows.length });
  } catch (err) {
    console.error('❌ Error al obtener intentos:', err);
    res.status(500).json({ error: 'Error al obtener intentos' });
  }
});

// Obtener intentos de un estudiante para un cuestionario
router.get('/attempts/:student_id/:questionnaire_id', async (req, res) => {
  const { student_id, questionnaire_id } = req.params;
  try {
    // Primero, obtener el ID del estudiante a partir del ID de usuario
    const [studentRows] = await pool.query(
      'SELECT id FROM students WHERE user_id = ?',
      [student_id]
    );

    if (studentRows.length === 0) {
      return res.json({ attempts: [], count: 0 });
    }

    const realStudentId = studentRows[0].id;
    
    // Obtener año académico actual para filtrar
    const currentAcademicYear = new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT attempt_number, score, attempt_date 
       FROM quiz_attempts 
       WHERE student_id = ? AND questionnaire_id = ?
       AND (academic_year = ? OR academic_year IS NULL)
       ORDER BY attempt_number`,
      [realStudentId, questionnaire_id, currentAcademicYear]
    );
    res.json({ attempts: rows, count: rows.length });
  } catch (err) {
    console.error('❌ Error al obtener intentos:', err);
    res.status(500).json({ error: 'Error al obtener intentos' });
  }
});

// Obtener preguntas por ID de cuestionario con información del cuestionario
// Para estudiantes: crea/retorna sesión con preguntas fijas y expires_at
router.get('/questions/:id', verifyToken, async (req, res) => {
  const questionnaireId = req.params.id;

  try {
    // Primero obtener la información del cuestionario
    // Verificar si el campo institution existe en users
    let hasInstitution = false;
    try {
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    const institutionField = hasInstitution ? ', u.institution as teacher_institution' : '';
    
    const [questionnaireInfo] = await pool.query(`
      SELECT 
        q.id, q.title, q.subject, q.category, q.grade, q.phase, q.course_id, q.questions_to_answer, q.time_limit_minutes, q.is_prueba_saber, q.description,
        u.name AS created_by_name, u.name AS teacher_name${institutionField},
        COALESCE(c.name, 'Todos los cursos') AS course_name
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE q.id = ?
    `, [questionnaireId]);

    if (questionnaireInfo.length === 0) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    // Extraer nombre de materia desde subject o category
    const questionnaire = questionnaireInfo[0];
    const subject_name = questionnaire.subject || questionnaire.category?.split('_')[1] || '';
    
    // Si no es estudiante, retornar como antes (sin sesión)
    if (req.user?.role !== 'estudiante') {
      const [questions] = await pool.query('SELECT * FROM questions WHERE questionnaire_id = ?', [questionnaireId]);
      let finalQuestions = questions;
      const limit = questionnaire.questions_to_answer ? parseInt(questionnaire.questions_to_answer, 10) : null;
      if (limit && finalQuestions.length > limit) {
        const shuffled = [...finalQuestions];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        finalQuestions = shuffled.slice(0, limit);
      }
      const totalAvailableQuestions = questions.length;
      const effectiveQuestionsToAnswer = limit ? Math.min(limit, totalAvailableQuestions) : totalAvailableQuestions;

      return res.json({
        questionnaire: {
          ...questionnaire,
          subject_name,
          total_available_questions: totalAvailableQuestions,
          effective_questions_to_answer: effectiveQuestionsToAnswer
        },
        questions: finalQuestions
      });
    }

    // Resolver student_id real desde token
    const [studentRows] = await pool.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (studentRows.length === 0) {
      return res.status(404).json({ error: 'No se encontró un perfil de estudiante para este usuario.' });
    }
    const realStudentId = studentRows[0].id;
    const currentAcademicYear = new Date().getFullYear();

    // Contar intentos usados: enviados + sesiones expiradas (para no “resetear” el tiempo con recargas)
    const [attemptRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM quiz_attempts 
       WHERE student_id = ? AND questionnaire_id = ? AND (academic_year = ? OR academic_year IS NULL)`,
      [realStudentId, questionnaireId, currentAcademicYear]
    );
    const completedCount = attemptRows?.[0]?.count || 0;

    const [expiredRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM quiz_sessions
       WHERE student_id = ? AND questionnaire_id = ? AND academic_year = ? AND status = 'expired'`,
      [realStudentId, questionnaireId, currentAcademicYear]
    );
    const expiredCount = expiredRows?.[0]?.count || 0;
    const usedCount = completedCount + expiredCount;

    if (usedCount >= 2) {
      return res.status(400).json({ error: 'Ya alcanzaste el límite de 2 intentos para esta evaluación.' });
    }

    const attemptNumber = usedCount + 1;

    // Buscar sesión activa para este intento
    // Buscar sesión activa - calcular remaining_seconds en MySQL para evitar problemas de zona horaria
    const [sessionRows] = await pool.query(
      `SELECT *,
       CASE 
         WHEN expires_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, NOW(), expires_at)
         ELSE NULL
       END as remaining_seconds
       FROM quiz_sessions
       WHERE student_id = ? AND questionnaire_id = ? AND academic_year = ? AND attempt_number = ? AND status = 'in_progress'
       ORDER BY started_at DESC
       LIMIT 1`,
      [realStudentId, questionnaireId, currentAcademicYear, attemptNumber]
    );
    let session = sessionRows[0] || null;

    // Verificar si la sesión expiró usando remaining_seconds calculado en MySQL
    if (session?.expires_at && (session.remaining_seconds === null || session.remaining_seconds <= 0)) {
      await pool.query(`UPDATE quiz_sessions SET status = 'expired' WHERE id = ?`, [session.id]);
      return res.status(400).json({ error: 'Se agotó el tiempo de la evaluación.', code: 'TIME_EXPIRED' });
    }

    // Si no hay sesión, crearla con preguntas fijas
    if (!session) {
      // Obtener IDs de preguntas
      const [questionIdRows] = await pool.query('SELECT id FROM questions WHERE questionnaire_id = ?', [questionnaireId]);
      const allIds = questionIdRows.map((r) => r.id);
      if (allIds.length === 0) {
        return res.status(404).json({ error: 'Cuestionario sin preguntas.' });
      }

      const limit = questionnaire.questions_to_answer ? parseInt(questionnaire.questions_to_answer, 10) : null;
      const effectiveLimit = limit ? Math.min(limit, allIds.length) : allIds.length;

      // Shuffle IDs y tomar slice
      const shuffledIds = [...allIds];
      for (let i = shuffledIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
      }
      const selectedIds = shuffledIds.slice(0, effectiveLimit);

      // Usar DATE_ADD de MySQL para calcular expires_at sin problemas de zona horaria
      const timeLimit = questionnaire.time_limit_minutes ? parseInt(questionnaire.time_limit_minutes, 10) : null;

      const [insertResult] = await pool.query(
        `INSERT INTO quiz_sessions (student_id, questionnaire_id, attempt_number, academic_year, status, started_at, expires_at, question_ids_json)
         VALUES (?, ?, ?, ?, 'in_progress', NOW(), 
         ${timeLimit ? 'DATE_ADD(NOW(), INTERVAL ? MINUTE)' : 'NULL'}, ?)`,
        timeLimit 
          ? [realStudentId, questionnaireId, attemptNumber, currentAcademicYear, timeLimit, JSON.stringify(selectedIds)]
          : [realStudentId, questionnaireId, attemptNumber, currentAcademicYear, JSON.stringify(selectedIds)]
      );

      // Recuperar la sesión con remaining_seconds calculado en MySQL
      const [newSessionRows] = await pool.query(
        `SELECT *,
         CASE 
           WHEN expires_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, NOW(), expires_at)
           ELSE NULL
         END as remaining_seconds
         FROM quiz_sessions WHERE id = ?`,
        [insertResult.insertId]
      );
      session = newSessionRows[0];
    }

    // Cargar preguntas en el orden de la sesión
    let sessionQuestionIds = [];
    try {
      sessionQuestionIds = JSON.parse(session.question_ids_json || '[]');
    } catch (e) {
      sessionQuestionIds = [];
    }

    if (sessionQuestionIds.length === 0) {
      return res.status(500).json({ error: 'Sesión inválida: no hay preguntas asignadas.' });
    }

    const placeholders = sessionQuestionIds.map(() => '?').join(',');
    const [questions] = await pool.query(
      `SELECT * FROM questions WHERE questionnaire_id = ? AND id IN (${placeholders})`,
      [questionnaireId, ...sessionQuestionIds]
    );

    // Reordenar según sessionQuestionIds
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const finalQuestions = sessionQuestionIds.map((id) => questionById.get(id)).filter(Boolean);

    const totalAvailableQuestions = finalQuestions.length;
    const effectiveQuestionsToAnswer = totalAvailableQuestions;
    
    // Usar remaining_seconds calculado en MySQL (ya viene en session)
    const remainingSeconds = session.remaining_seconds !== null && session.remaining_seconds !== undefined 
      ? Math.max(0, session.remaining_seconds) 
      : null;

    // Devolver tanto la información del cuestionario como las preguntas
    res.json({
      questionnaire: {
        ...questionnaire,
        subject_name,
        total_available_questions: totalAvailableQuestions,
        effective_questions_to_answer: effectiveQuestionsToAnswer,
        time_limit_minutes: questionnaire.time_limit_minutes || null
      },
      session: {
        id: session.id,
        attempt_number: session.attempt_number,
        started_at: session.started_at,
        expires_at: session.expires_at,
        remaining_seconds: remainingSeconds
      },
      questions: finalQuestions
    });
  } catch (err) {
    console.error('Error al obtener preguntas:', err);
    res.status(500).json({ error: 'Error al obtener preguntas' });
  }
});

// Obtener intentos y notas por fase para un estudiante
router.get('/intentos-por-fase/:studentId', async (req, res) => {
  const studentId = req.params.studentId;

  try {
    // Primero, obtener el ID del estudiante a partir del ID de usuario
    const [studentRows] = await pool.query(
      'SELECT id, course_id FROM students WHERE user_id = ?',
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.json([]);
    }

    const realStudentId = studentRows[0].id;
    const courseId = studentRows[0].course_id;
    
    // Obtener año académico actual para filtrar
    const currentAcademicYear = new Date().getFullYear();

    const [attempts] = await pool.query(`
      SELECT 
        qa.questionnaire_id,
        qa.attempt_number,
        qa.score,
        qa.attempt_date,
        qa.phase,
        g.phase1, g.phase2, g.phase3, g.phase4,
        g.average,
        q.title AS questionnaire_title,
        q.phase AS questionnaire_phase
      FROM quiz_attempts qa
      JOIN grades g ON qa.student_id = g.student_id 
        AND (g.academic_year = ? OR g.academic_year IS NULL)
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      WHERE qa.student_id = ? AND (q.course_id = ? OR q.course_id IS NULL)
      AND (qa.academic_year = ? OR qa.academic_year IS NULL)
      ORDER BY qa.attempt_date DESC
    `, [currentAcademicYear, realStudentId, courseId, currentAcademicYear]);

    res.json(attempts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener intentos por fase.' });
  }
});

// Nueva ruta para obtener evaluaciones por fase
router.get('/evaluations-by-phase/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    // Obtener el ID real del estudiante
    const [studentRows] = await pool.query(
      'SELECT id FROM students WHERE user_id = ?',
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.json([]);
    }

    const realStudentId = studentRows[0].id;
    
    // Obtener año académico actual para filtrar
    const currentAcademicYear = new Date().getFullYear();

    // Obtener docente e institución del estudiante primero
    const [studentInfo] = await pool.query(`
      SELECT 
        s.id as student_id,
        COALESCE(s.institution, u.institution) AS institution,
        t.id as teacher_id,
        ut.name AS teacher_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN teacher_students ts ON s.id = ts.student_id 
        AND (ts.academic_year = ? OR ts.academic_year IS NULL)
      LEFT JOIN teachers t ON ts.teacher_id = t.id
      LEFT JOIN users ut ON t.user_id = ut.id
      WHERE s.id = ?
      LIMIT 1
    `, [currentAcademicYear, realStudentId]);
    
    const teacherName = studentInfo.length > 0 ? (studentInfo[0].teacher_name || null) : null;
    const institution = studentInfo.length > 0 ? (studentInfo[0].institution || null) : null;
    const teacherId = studentInfo.length > 0 ? (studentInfo[0].teacher_id || null) : null;

    // Obtener evaluaciones por fase + phase_averages (average_score, average_score_manual) y grades (definitiva)
    const [evaluations] = await pool.query(`
      SELECT 
        q.phase,
        COUNT(er.id) AS total_evaluations,
        AVG(er.best_score) AS phase_average_system,
        MAX(pa.average_score) AS average_score,
        MAX(pa.average_score_manual) AS average_score_manual,
        MAX(g.phase1) AS phase1, MAX(g.phase2) AS phase2, MAX(g.phase3) AS phase3, MAX(g.phase4) AS phase4,
        MAX(g.average) AS overall_average
      FROM evaluation_results er
      JOIN questionnaires q ON er.questionnaire_id = q.id
      LEFT JOIN grades g ON er.student_id = g.student_id 
        AND (g.academic_year = ? OR g.academic_year IS NULL)
      LEFT JOIN phase_averages pa ON pa.student_id = er.student_id 
        AND pa.phase = q.phase
        AND (pa.teacher_id = ? OR ? IS NULL)
      WHERE er.student_id = ? 
      AND (er.academic_year = ? OR er.academic_year IS NULL)
      GROUP BY q.phase
      ORDER BY q.phase
    `, [currentAcademicYear, teacherId, teacherId, realStudentId, currentAcademicYear]);

    // Definitiva: grades.phaseN si existe; si no, sistema. Incluir average_score (sistema) y average_score_manual.
    const evaluationsWithInfo = evaluations.map(ev => {
      const phaseCol = `phase${ev.phase}`;
      const definitive = ev[phaseCol] != null ? parseFloat(ev[phaseCol]) : (ev.average_score != null ? parseFloat(ev.average_score) : ev.phase_average_system);
      const systemScore = ev.average_score != null ? parseFloat(ev.average_score) : (ev.phase_average_system != null ? parseFloat(ev.phase_average_system) : null);
      const manualScore = ev.average_score_manual != null ? parseFloat(ev.average_score_manual) : null;
      return {
        phase: ev.phase,
        total_evaluations: ev.total_evaluations,
        phase_average: definitive,
        average_score: systemScore,
        average_score_manual: manualScore,
        phase1: ev.phase1,
        phase2: ev.phase2,
        phase3: ev.phase3,
        phase4: ev.phase4,
        overall_average: ev.overall_average,
        teacher_name: teacherName,
        institution: institution,
        academic_year: currentAcademicYear
      };
    });

    res.json(evaluationsWithInfo);
  } catch (error) {
    console.error('Error al obtener evaluaciones por fase:', error);
    res.status(500).json({ error: 'Error al obtener evaluaciones por fase.' });
  }
});

// Obtener los mejores resultados de evaluación para un estudiante (evaluation_results)
router.get('/student/evaluation-results/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    // Obtener el ID real del estudiante
    const [studentRows] = await pool.query(
      'SELECT id FROM students WHERE user_id = ?',
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.json([]);
    }

    const realStudentId = studentRows[0].id;
    
    // Obtener año académico actual para filtrar
    const currentAcademicYear = new Date().getFullYear();

    // Consulta para obtener los mejores resultados con información adicional (filtrados por academic_year)
    const [rows] = await pool.query(`
      SELECT 
        er.id,
        er.student_id,
        er.questionnaire_id,
        er.best_score,
        er.selected_attempt_id,
        er.phase,
        er.recorded_at,
        q.title,
        q.category,
        qa.attempt_number
      FROM evaluation_results er
      JOIN questionnaires q ON er.questionnaire_id = q.id
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      WHERE er.student_id = ?
      AND (er.academic_year = ? OR er.academic_year IS NULL)
      ORDER BY er.phase, er.recorded_at DESC
    `, [realStudentId, currentAcademicYear]);

    // Agregar subject_name si es necesario
    const processedRows = rows.map(row => ({
      ...row,
      subject_name: row.category?.split('_')[1] || ''
    }));

    res.json(processedRows);
  } catch (error) {
    console.error('Error al obtener resultados de evaluación:', error);
    res.status(500).json({ error: 'Error al obtener resultados de evaluación' });
  }
});

// Obtener todos los intentos de un estudiante con detalles
router.get('/student/attempts/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    // Obtener el ID real del estudiante
    const [studentRows] = await pool.query(
      'SELECT id FROM students WHERE user_id = ?',
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.json([]);
    }

    const realStudentId = studentRows[0].id;
    
    // Obtener año académico actual para filtrar
    const currentAcademicYear = new Date().getFullYear();

    // Consulta para obtener todos los intentos con información adicional (filtrados por academic_year)
    const [rows] = await pool.query(`
      SELECT 
        qa.id AS attempt_id,
        qa.student_id,
        qa.questionnaire_id,
        qa.attempt_number,
        qa.score,
        qa.attempt_date AS attempted_at,
        qa.phase,
        q.title,
        q.category
      FROM quiz_attempts qa
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      WHERE qa.student_id = ?
      AND (qa.academic_year = ? OR qa.academic_year IS NULL)
      ORDER BY qa.attempt_date DESC
    `, [realStudentId, currentAcademicYear]);

    // Agregar subject_name si es necesario
    const processedRows = rows.map(row => ({
      ...row,
      subject_name: row.category?.split('_')[1] || ''
    }));

    res.json(processedRows);
  } catch (error) {
    console.error('Error al obtener intentos de evaluación:', error);
    res.status(500).json({ error: 'Error al obtener intentos de evaluación' });
  }
});

export default router;
