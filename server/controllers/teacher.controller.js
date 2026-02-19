// controllers/teacher.controller.js
import db from '../config/db.js';

export const getStudentProgress = async (req, res) => {
    const { questionnaire_id } = req.params;
    
    // Carlos Ferreira es user_id: 23 en tu tabla 'users'
    // Pero en las consultas necesitamos el ID de la tabla 'teachers' (que es 2)
    const userId = req.user?.id || req.usuario_id;

    try {
        // Esta consulta une las tablas según tu script: 
        // teachers (user_id) -> teacher_students -> students -> users
        const query = `
            SELECT 
                s.id as student_id, 
                u.name as student_name, 
                u.email,
                u.profile_image as student_profile_image,
                qs.id as session_id, 
                qs.status, 
                qa.score,
                IFNULL(qa.attempt_number, IFNULL(qs.attempt_number, 0)) as attempt_number
            FROM students s
            JOIN users u ON s.user_id = u.id
            INNER JOIN teacher_students ts ON s.id = ts.student_id
            INNER JOIN teachers t ON ts.teacher_id = t.id
            LEFT JOIN quiz_sessions qs ON s.id = qs.student_id AND qs.questionnaire_id = ?
            LEFT JOIN quiz_attempts qa ON s.id = qa.student_id AND qa.questionnaire_id = ?
            WHERE t.user_id = ?
            ORDER BY u.name`;

        const [rows] = await db.query(query, [questionnaire_id, questionnaire_id, userId]);
        res.json(rows);
    } catch (err) {
        console.error("Error en progreso:", err);
        res.status(500).json({ error: 'Error al obtener progreso' });
    }
};

// Agrega estas funciones vacías para que no den error 404 al importar
export const getTeacherSessions = async (req, res) => res.json([]);
export const createTeacherSession = async (req, res) => res.json({success: true});