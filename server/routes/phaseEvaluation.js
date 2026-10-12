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

router.get('/plan-template/:phase', verifyToken, requireTeacher, async (req, res) => {
  try {
    const phase = Number(req.params.phase);
    if (!Number.isInteger(phase) || phase < 1 || phase > 4) return res.status(400).json({ message: 'Fase inválida.' });
    const requestedIds = normalizeCourseIds(req.query.courseIds);
    const courseIds = await getAuthorizedCourseIds(req.user.teacher_id, requestedIds);
    if (!courseIds.length || courseIds.length !== requestedIds.length) return res.status(400).json({ message: 'Selecciona cursos asignados al docente.' });
    const [rows] = await pool.query(`
      SELECT course_id, phase, title, subject, description, activities, deadline_days, enabled
      FROM phase_improvement_plan_templates
      WHERE teacher_id = ? AND phase = ? AND academic_year = ? AND course_id IN (?)
    `, [req.user.teacher_id, phase, new Date().getFullYear(), courseIds]);
    res.json(rows);
  } catch (error) {
    console.error('Error cargando plantilla de recuperación:', error);
    res.status(500).json({ message: 'No se pudo cargar la plantilla. Verifica que la migración de planes por fase esté aplicada.' });
  }
});

router.put('/plan-template/:phase', verifyToken, requireTeacher, async (req, res) => {
  try {
    const phase = Number(req.params.phase);
    const { title, subject, description, activities, deadlineDays = 14, enabled = true } = req.body || {};
    const requestedIds = normalizeCourseIds(req.body?.courseIds);
    const courseIds = await getAuthorizedCourseIds(req.user.teacher_id, requestedIds);
    if (!Number.isInteger(phase) || phase < 1 || phase > 4) return res.status(400).json({ message: 'Fase inválida.' });
    if (!courseIds.length || courseIds.length !== requestedIds.length) return res.status(400).json({ message: 'Selecciona cursos asignados al docente.' });
    if (!String(title || '').trim() || !String(subject || '').trim() || !String(activities || '').trim()) {
      return res.status(400).json({ message: 'Título, materia y actividades son obligatorios.' });
    }
    const days = Math.min(90, Math.max(1, Number.parseInt(deadlineDays, 10) || 14));
    const year = new Date().getFullYear();
    for (const courseId of courseIds) {
      await pool.query(`
        INSERT INTO phase_improvement_plan_templates
          (teacher_id, course_id, phase, academic_year, title, subject, description, activities, deadline_days, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title = VALUES(title), subject = VALUES(subject),
          description = VALUES(description), activities = VALUES(activities),
          deadline_days = VALUES(deadline_days), enabled = VALUES(enabled), updated_at = CURRENT_TIMESTAMP
      `, [req.user.teacher_id, courseId, phase, year, String(title).trim(), String(subject).trim(),
        String(description || '').trim(), String(activities).trim(), days, enabled ? 1 : 0]);
    }
    res.json({ success: true, savedCourses: courseIds.length, message: `Plantilla guardada para ${courseIds.length} curso(s) en la fase ${phase}.` });
  } catch (error) {
    console.error('Error guardando plantilla de recuperación:', error);
    res.status(500).json({ message: 'No se pudo guardar la plantilla. Verifica que la migración de planes por fase esté aplicada.' });
  }
});

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
