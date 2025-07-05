import express from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware para verificar el rol de docente o superadmin
const isTeacherOrAdmin = (req, res, next) => {
    if (req.user.role !== 'docente' && req.user.role !== 'super_administrador') {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de Docente o Super Administrador.' });
    }
    next();
};

// Ruta para obtener los estudiantes asignados a un docente
router.get('/students/:teacherId', verifyToken, isTeacherOrAdmin, async (req, res) => {
    try {
        const { teacherId } = req.params;
        const query = `
            SELECT s.id, u.name, u.email, u.phone 
            FROM teacher_students ts
            JOIN students s ON ts.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE ts.teacher_id = ?
        `;
        const [students] = await pool.query(query, [teacherId]);
        res.json(students);
    } catch (error) {
        console.error('❌ Error al obtener estudiantes del docente:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para obtener las calificaciones de los estudiantes de un docente
router.get('/student-grades/:teacherId', verifyToken, isTeacherOrAdmin, async (req, res) => {
    try {
        const { teacherId } = req.params;
        const query = `
            SELECT er.id, s.id AS student_id, u.name AS student_name, q.name AS quiz_name, er.score, er.evaluation_date
            FROM evaluation_results er
            JOIN students s ON er.student_id = s.id
            JOIN users u ON s.user_id = u.id
            JOIN quizzes q ON er.quiz_id = q.id
            JOIN teacher_students ts ON s.id = ts.student_id
            WHERE ts.teacher_id = ?
            ORDER BY er.evaluation_date DESC
        `;
        const [grades] = await pool.query(query, [teacherId]);
        res.json(grades);
    } catch (error) {
        console.error('❌ Error al obtener calificaciones de los estudiantes:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Obtener ID de profesor por user_id
router.get('/user/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const [teacher] = await pool.query(
            'SELECT id FROM teachers WHERE user_id = ?', 
            [userId]
        );
        
        if (teacher.length === 0) {
            return res.status(404).json({ message: 'Profesor no encontrado' });
        }
        
        res.json(teacher[0]);
    } catch (error) {
        console.error('❌ Error al obtener ID de profesor:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

export default router;
