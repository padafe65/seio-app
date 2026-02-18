export const finishQuiz = async (req, res) => {
    const { session_id, answers } = req.body;
    try {
        await db.query(
            'UPDATE quiz_sessions SET answers_json = ?, status = ? WHERE id = ?',
            [JSON.stringify(answers), 'submitted', session_id]
        );
        // Aquí puedes agregar la lógica para registrar el intento en quiz_attempts
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error finalizando evaluación', details: err });
    }
};
import db from '../config/db.js';

// Iniciar o reanudar sesión de cuestionario
export const startOrResumeSession = async (req, res) => {
    const { student_id, questionnaire_id, academic_year } = req.body;
    try {
        // Buscar sesión existente
        const [sessions] = await db.query(
            'SELECT * FROM quiz_sessions WHERE student_id = ? AND questionnaire_id = ? AND academic_year = ? ORDER BY attempt_number DESC LIMIT 1',
            [student_id, questionnaire_id, academic_year]
        );
        let session = sessions[0];
        if (!session) {
            // Crear nueva sesión
            const [result] = await db.query(
                'INSERT INTO quiz_sessions (student_id, questionnaire_id, academic_year, attempt_number, answers_json) VALUES (?, ?, ?, 1, ?)',
                [student_id, questionnaire_id, academic_year, '{}']
            );
            session = {
                id: result.insertId,
                student_id,
                questionnaire_id,
                academic_year,
                attempt_number: 1,
                answers_json: '{}',
            };
        }
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: 'Error iniciando sesión de cuestionario', details: err });
    }
};

// Guardar progreso
export const saveProgress = async (req, res) => {
    const { session_id, answers } = req.body;
    try {
        await db.query(
            'UPDATE quiz_sessions SET answers_json = ? WHERE id = ?',
            [JSON.stringify(answers), session_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error guardando progreso', details: err });
    }
};