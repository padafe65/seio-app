import express from 'express';
import { evaluatePhaseResults } from '../services/phaseEvaluationService.js';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

const requireTeacher = (req, res, next) => {
  if (req.user?.role !== 'docente' || !req.user.teacher_id) {
    return res.status(403).json({ success: false, message: 'Solo un docente con perfil activo puede evaluar sus fases.' });
  }
  return next();
};

const normalizeCourseIds = (value) => {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map(Number).filter(id => Number.isInteger(id) && id > 0))];
};

const getAuthorizedCourseIds = async (teacherId, requestedIds) => {
  if (!requestedIds.length) return [];
  const [rows] = await pool.query(`
    SELECT DISTINCT c.id
    FROM courses c
    WHERE c.id IN (?)
      AND (c.teacher_id = ? OR EXISTS (
        SELECT 1 FROM teacher_courses tc WHERE tc.teacher_id = ? AND tc.course_id = c.id
      ))
  `, [requestedIds, teacherId, teacherId]);
  return rows.map(row => Number(row.id));
};

router.get('/courses', verifyToken, requireTeacher, async (req, res) => {
  try {
    const [courses] = await pool.query(`
      SELECT DISTINCT c.id, c.name,
        COALESCE(c.institution, '') AS institution,
        GROUP_CONCAT(DISTINCT s.grade ORDER BY s.grade SEPARATOR ', ') AS grades,
        COUNT(DISTINCT s.id) AS student_count
      FROM courses c
      LEFT JOIN students s ON s.course_id = c.id
      WHERE c.teacher_id = ? OR EXISTS (
        SELECT 1 FROM teacher_courses tc WHERE tc.teacher_id = ? AND tc.course_id = c.id
      )
      GROUP BY c.id, c.name, c.institution
      ORDER BY c.name
    `, [req.user.teacher_id, req.user.teacher_id]);
    res.json(courses);
  } catch (error) {
    console.error('Error al cargar cursos para evaluación de fase:', error);
    res.status(500).json({ message: 'No se pudieron cargar los cursos del docente.' });
  }
});

router.post('/evaluate-phase/:phase', verifyToken, requireTeacher, async (req, res) => {
  try {
    const phaseNum = parseInt(req.params.phase, 10);
    if (!Number.isInteger(phaseNum) || phaseNum < 1 || phaseNum > 4) {
      return res.status(400).json({ message: 'Fase inválida. Debe ser un número entre 1 y 4.' });
    }
    const requestedIds = normalizeCourseIds(req.body?.courseIds);
    const authorizedIds = await getAuthorizedCourseIds(req.user.teacher_id, requestedIds);
    if (!requestedIds.length || authorizedIds.length !== requestedIds.length) {
      return res.status(400).json({ message: 'Selecciona uno o más cursos que estén asignados a tu perfil.' });
    }
    const result = await evaluatePhaseResults(phaseNum, req.user.teacher_id, authorizedIds);
    if (result.success) return res.json({ message: result.message });
    return res.status(500).json({ message: 'Error en la evaluación de fase', error: result.error });
  } catch (error) {
    console.error('Error en evaluación de fase:', error);
    res.status(500).json({ message: 'Error en la evaluación de fase' });
  }
});

router.get('/phase-stats/:phase', verifyToken, requireTeacher, async (req, res) => {
  try {
    const phaseNum = parseInt(req.params.phase, 10);
    if (!Number.isInteger(phaseNum) || phaseNum < 1 || phaseNum > 4) {
      return res.status(400).json({ message: 'Fase inválida. Debe ser un número entre 1 y 4.' });
    }
    const requestedIds = normalizeCourseIds(req.query.courseIds);
    const authorizedIds = await getAuthorizedCourseIds(req.user.teacher_id, requestedIds);
    if (!requestedIds.length || authorizedIds.length !== requestedIds.length) {
      return res.status(400).json({ message: 'Selecciona uno o más cursos que estén asignados a tu perfil.' });
    }
    const [stats] = await pool.query(`
      SELECT
        COUNT(DISTINCT s.id) AS total_students,
        COUNT(DISTINCT CASE WHEN g.phase${phaseNum} >= 3.5 THEN s.id END) AS approved_students,
        COUNT(DISTINCT CASE WHEN g.phase${phaseNum} < 3.5 THEN s.id END) AS failed_students,
        AVG(g.phase${phaseNum}) AS average_score
      FROM grades g
      JOIN students s ON s.id = g.student_id
      JOIN courses c ON c.id = s.course_id
      WHERE g.phase${phaseNum} IS NOT NULL AND c.id IN (?)
    `, [authorizedIds]);
    res.json(stats[0]);
  } catch (error) {
    console.error('Error al obtener estadísticas de fase:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas de fase' });
  }
});

export default router;
