import express from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/generate-grade-report', verifyToken, async (req, res) => {
    const { studentId, courseId } = req.query;
    const currentYear = new Date().getFullYear();

    try {
        let query = "";
        let params = [];

        if (studentId) {
            const requestedStudentId = Number(studentId);
            if (req.user.role === 'estudiante' && requestedStudentId !== Number(req.user.student_id)) {
                return res.status(403).json({ error: 'Solo puedes consultar tu propio reporte.' });
            }
            if (req.user.role === 'docente') {
                const [assigned] = await pool.query(
                    'SELECT id FROM teacher_students WHERE student_id = ? AND teacher_id = ?',
                    [requestedStudentId, req.user.teacher_id]
                );
                if (!assigned.length) return res.status(403).json({ error: 'No tienes acceso a este estudiante.' });
            }
            // REPORTE INDIVIDUAL: Trae fases y datos del alumno
            query = `
                SELECT 
                    u.name as student_name, s.institution, c.name as course_name,
                    q.title as exam_title,
                    g.phase1, g.phase2, g.phase3, g.phase4, g.average as final_grade
                FROM students s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN courses c ON s.course_id = c.id
                LEFT JOIN grades g ON s.id = g.student_id AND (g.academic_year = ? OR g.academic_year IS NULL)
                LEFT JOIN questionnaires q ON g.questionnaire_id = q.id
                WHERE s.id = ?`;
            params = [currentYear, studentId];
        } else if (courseId) {
            if (req.user.role === 'docente') {
                const [assignedCourse] = await pool.query(
                    'SELECT id FROM teacher_courses WHERE teacher_id = ? AND course_id = ?',
                    [req.user.teacher_id, courseId]
                );
                if (!assignedCourse.length) return res.status(403).json({ error: 'No tienes acceso a este curso.' });
            } else if (!['admin', 'administrador', 'super_administrador'].includes(req.user.role)) {
                return res.status(403).json({ error: 'No tienes permiso para generar reportes grupales.' });
            }
            // REPORTE GRUPAL (PLANILLA): Trae a TODOS los alumnos con sus fases
            query = `
                SELECT 
                    u.name as student_name, u.email as student_email,
                    s.institution, c.name as course_name,
                    g.phase1, g.phase2, g.phase3, g.phase4, g.average as final_grade
                FROM students s
                JOIN users u ON s.user_id = u.id
                JOIN courses c ON s.course_id = c.id
                LEFT JOIN grades g ON s.id = g.student_id AND (g.academic_year = ? OR g.academic_year IS NULL)
                WHERE s.course_id = ?
                ORDER BY u.name ASC`;
            params = [currentYear, courseId];
        } else {
            return res.status(400).json({ error: "Debe proporcionar studentId o courseId" });
        }

        const [results] = await pool.query(query, params);
        res.json(results);
    } catch (error) {
        console.error("Error en reporte:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

export default router;
