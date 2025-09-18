// server/routes/teacherSubjectsRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware para verificar el rol de docente o superadmin
const isTeacherOrAdmin = (req, res, next) => {
    if (req.user.role !== 'docente' && req.user.role !== 'super_administrador') {
        return res.status(403).json({ 
            message: 'Acceso denegado. Se requiere rol de Docente o Super Administrador.' 
        });
    }
    next();
};

// Obtener materia específica de un docente
router.get('/teacher/:teacherId/subject/:subjectId', verifyToken, isTeacherOrAdmin, async (req, res) => {
    try {
        const { teacherId, subjectId } = req.params;
        
        // Verificar que el docente existe
        const [teacher] = await pool.query(
            'SELECT id FROM teachers WHERE id = ?',
            [teacherId]
        );
        
        if (teacher.length === 0) {
            return res.status(404).json({ message: 'Docente no encontrado' });
        }
        
        // Obtener la materia específica del docente
        const [subjects] = await pool.query(`
            SELECT 
                s.id,
                s.name,
                s.description,
                c.name as course_name,
                c.grade
            FROM teacher_subjects ts
            JOIN subjects s ON ts.subject_id = s.id
            JOIN courses c ON s.course_id = c.id
            WHERE ts.teacher_id = ? AND s.id = ?
        `, [teacherId, subjectId]);
        
        if (subjects.length === 0) {
            return res.status(404).json({ 
                message: 'Materia no encontrada o no asignada al docente' 
            });
        }
        
        res.json(subjects[0]);
    } catch (error) {
        console.error('❌ Error al obtener materia del docente:', error);
        res.status(500).json({ 
            message: 'Error al obtener materia del docente',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
