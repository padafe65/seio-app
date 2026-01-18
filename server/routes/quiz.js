// routes/quiz.js
import express from 'express';
import pool from '../config/db.js';  // tu conexión MySQL
const router = express.Router();

router.post('/submit', async (req, res) => {
  const { student_id, questionnaire_id, answers } = req.body;

  try {
    // Primero, obtener el ID del estudiante a partir del ID de usuario
    const [studentRows] = await pool.query(
      'SELECT id, grade FROM students WHERE user_id = ?',
      [student_id]
    );
    
    if (studentRows.length === 0) {
      return res.status(404).json({ 
        message: 'No se encontró un perfil de estudiante para este usuario. Por favor, complete su perfil primero.' 
      });
    }

    const realStudentId = studentRows[0].id;
    
    // 1. Obtener todas las preguntas del cuestionario
    const [questions] = await pool.query(
      'SELECT id, correct_answer FROM questions WHERE questionnaire_id = ?',
      [questionnaire_id]
    );

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado o sin preguntas.' });
    }

    // 2. Calcular aciertos
    let correctCount = 0;
    for (const question of questions) {
      const studentAnswer = answers[question.id];
      if (studentAnswer && studentAnswer === question.correct_answer) {
        correctCount++;
      }
    }

    const totalQuestions = questions.length;
    const score = parseFloat(((correctCount / totalQuestions) * 5).toFixed(2));

    // 3. Contar intentos previos
    const [attempts] = await pool.query(
      `SELECT COUNT(*) AS count FROM quiz_attempts 
       WHERE student_id = ? AND questionnaire_id = ?`,
      [realStudentId, questionnaire_id]
    );

    const attemptNumber = attempts[0].count + 1;

    // Mantener el límite de 2 intentos por evaluación
    if (attemptNumber > 2) {
      return res.status(400).json({ message: 'Ya has realizado los 2 intentos permitidos.' });
    }

    // 6. Obtener la fase del cuestionario
    const [questionnaireInfo] = await pool.query(
      'SELECT phase, created_by, grade FROM questionnaires WHERE id = ?',
      [questionnaire_id]
    );

    if (questionnaireInfo.length === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado.' });
    }

    const phaseNumber = questionnaireInfo[0].phase;
    const teacherId = questionnaireInfo[0].created_by;
    const questionnaireGrade = questionnaireInfo[0].grade;

    // Obtener el año académico actual
    const currentAcademicYear = new Date().getFullYear();

    // 4. Insertar intento con el ID de estudiante correcto, la fase y el año académico
    const [result] = await pool.query(
      `INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score, phase, academic_year)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [realStudentId, questionnaire_id, attemptNumber, score, phaseNumber, currentAcademicYear]
    );

    const attemptId = result.insertId;

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
        // Actualizar si esta nota es mejor (y actualizar academic_year si es NULL)
        await pool.query(
          `UPDATE evaluation_results 
           SET best_score = ?, selected_attempt_id = ?, recorded_at = CURRENT_TIMESTAMP, 
               academic_year = COALESCE(academic_year, ?)
           WHERE id = ?`,
          [score, attemptId, currentAcademicYear, current.id]
        );
      }
    }

    // MODIFICACIÓN PRINCIPAL: Calcular el promedio de todas las mejores notas de la fase
    // Obtener todas las mejores notas de evaluaciones en esta fase (filtradas por academic_year)
    const [phaseEvaluations] = await pool.query(
      `SELECT er.best_score 
       FROM evaluation_results er
       JOIN questionnaires q ON er.questionnaire_id = q.id
       WHERE er.student_id = ? AND q.phase = ? 
       AND (er.academic_year = ? OR er.academic_year IS NULL)`,
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
router.get('/questions/:id', async (req, res) => {
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
        q.id, q.title, q.subject, q.category, q.grade, q.phase, q.course_id, q.description,
        u.name AS created_by_name, u.name AS teacher_name${institutionField},
        c.name AS course_name
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users u ON t.user_id = u.id
      JOIN courses c ON q.course_id = c.id
      WHERE q.id = ?
    `, [questionnaireId]);

    if (questionnaireInfo.length === 0) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    // Extraer nombre de materia desde subject o category
    const questionnaire = questionnaireInfo[0];
    const subject_name = questionnaire.subject || questionnaire.category?.split('_')[1] || '';
    
    // Luego obtener las preguntas
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ?',
      [questionnaireId]
    );

    // Devolver tanto la información del cuestionario como las preguntas
    res.json({
      questionnaire: {
        ...questionnaire,
        subject_name
      },
      questions
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
      WHERE qa.student_id = ? AND q.course_id = ?
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

    // Obtener todas las evaluaciones agrupadas por fase (filtradas por academic_year)
    const [evaluations] = await pool.query(`
      SELECT 
        q.phase,
        COUNT(er.id) AS total_evaluations,
        AVG(er.best_score) AS phase_average,
        g.phase1, g.phase2, g.phase3, g.phase4,
        g.average AS overall_average
      FROM evaluation_results er
      JOIN questionnaires q ON er.questionnaire_id = q.id
      LEFT JOIN grades g ON er.student_id = g.student_id 
        AND (g.academic_year = ? OR g.academic_year IS NULL)
      WHERE er.student_id = ? 
      AND (er.academic_year = ? OR er.academic_year IS NULL)
      GROUP BY q.phase
      ORDER BY q.phase
    `, [currentAcademicYear, realStudentId, currentAcademicYear]);
    
    // Agregar información del docente, institución y período académico a cada fase
    const evaluationsWithInfo = evaluations.map(evaluation => ({
      ...evaluation,
      teacher_name: teacherName,
      institution: institution,
      academic_year: currentAcademicYear
    }));

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
