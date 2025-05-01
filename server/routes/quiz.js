// routes/quiz.js
import express from 'express';
import pool from '../config/db.js';  // tu conexión MySQL
const router = express.Router();

router.post('/submit', async (req, res) => {
  const { student_id, questionnaire_id, answers } = req.body;

  try {
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
      [student_id, questionnaire_id]
    );

    const attemptNumber = attempts[0].count + 1;

    if (attemptNumber > 2) {
      return res.status(400).json({ message: 'Ya has realizado los 2 intentos permitidos.' });
    }

    // 4. Insertar intento
    const [result] = await pool.query(
      `INSERT INTO quiz_attempts (student_id, questionnaire_id, attempt_number, score)
       VALUES (?, ?, ?, ?)`,
      [student_id, questionnaire_id, attemptNumber, score]
    );

    const attemptId = result.insertId;

    // 5. Verificar si actualizar o crear en evaluation_results
    const [existingEval] = await pool.query(
      `SELECT id, best_score, selected_attempt_id FROM evaluation_results 
       WHERE student_id = ? AND questionnaire_id = ?`,
      [student_id, questionnaire_id]
    );

    if (existingEval.length === 0) {
      // Nuevo resultado
      await pool.query(
        `INSERT INTO evaluation_results (student_id, questionnaire_id, best_score, selected_attempt_id, phase)
         VALUES (?, ?, ?, ?, ?)`,
        [student_id, questionnaire_id, score, attemptId, 1]  // fase puedes ajustar dinámicamente
      );
    } else {
      const current = existingEval[0];
      if (score > current.best_score) {
        // Actualizar si esta nota es mejor
        await pool.query(
          `UPDATE evaluation_results 
           SET best_score = ?, selected_attempt_id = ?, recorded_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [score, attemptId, current.id]
        );
      }
    }

    res.json({ message: 'Evaluación registrada correctamente.', score });

  } catch (error) {
    console.error('Error al registrar evaluación:', error);
    res.status(500).json({ message: 'Error al procesar el intento.' });
  }
});

/*// Verificar cantidad de intentos por estudiante en un cuestionario
router.get('/attempts/:studentId/:questionnaireId', async (req, res) => {
  const { studentId, questionnaireId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS attempts
       FROM quiz_attempts
       WHERE student_id = ? AND questionnaire_id = ?`,
      [studentId, questionnaireId]
    );

    res.json({ attempts: rows[0].attempts });
  } catch (err) {
    console.error('❌ Error al verificar intentos:', err);
    res.status(500).json({ error: 'Error al verificar intentos del cuestionario' });
  }
});*/

// Obtener intentos de un estudiante para un cuestionario
router.get('/attempts/:student_id/:questionnaire_id', async (req, res) => {
  const { student_id, questionnaire_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT attempt_number, score, attempted_at 
       FROM quiz_attempts 
       WHERE student_id = ? AND questionnaire_id = ?
       ORDER BY attempt_number`,
      [student_id, questionnaire_id]
    );
    res.json({ attempts: rows, count: rows.length });
  } catch (err) {
    console.error('❌ Error al obtener intentos:', err);
    res.status(500).json({ error: 'Error al obtener intentos' });
  }
});



export default router;
