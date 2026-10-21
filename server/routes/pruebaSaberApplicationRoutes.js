import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const staffRoles = new Set(['docente', 'administrador', 'admin', 'super_administrador']);
const elevatedRoles = new Set(['administrador', 'admin', 'super_administrador']);
const hashEnrollmentCode = (code) => createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
const isPreicfesCourse = (course) => /pre.?icfes|crecer/i.test(`${course.institution || ''} ${course.name || ''}`);

const studentForUser = async (userId) => {
  const [rows] = await pool.query('SELECT id, course_id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
};

const studentHasCourse = async (student, courseId) => {
  if (!student) return false;
  if (Number(student.course_id) === Number(courseId)) return true;
  const [rows] = await pool.query(`SELECT id FROM prueba_saber_course_enrollments
    WHERE student_id = ? AND course_id = ? AND status = 'active' LIMIT 1`, [student.id, courseId]);
  return rows.length > 0;
};

const getApplication = async (id) => {
  const [rows] = await pool.query(`
    SELECT a.*, q.subject, q.grade, q.prueba_saber_level, q.title AS questionnaire_title,
      c.name AS course_name, (SELECT COUNT(*) FROM prueba_saber_application_attempts x WHERE x.application_id = a.id AND x.status IN ('submitted','expired') AND x.score IS NOT NULL) AS completed_count
    FROM prueba_saber_applications a
    JOIN questionnaires q ON q.id = a.questionnaire_id
    JOIN courses c ON c.id = a.course_id
    WHERE a.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
};

const gradeAnswers = (ids, answers, correctById) => {
  let correct = 0;
  ids.forEach((id) => {
    const answer = answers[id];
    const normalized = typeof answer === 'number' || /^[1-4]$/.test(String(answer))
      ? `option${Number(answer)}`
      : /^[A-D]$/i.test(String(answer)) ? `option${String(answer).toUpperCase().charCodeAt(0) - 64}` : String(answer || '');
    if (normalized && normalized === String(correctById.get(String(id)))) correct += 1;
  });
  return { correct, score: Number((correct / ids.length * 5).toFixed(2)) };
};

// Resume los espacios formativos sin cambiar la institución de origen del alumno.
router.get('/contexts', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'estudiante') {
      const student = await studentForUser(req.user.id);
      if (!student) return res.json({ success: true, data: { school: null, preicfes: [] } });
      const [schoolRows] = await pool.query(`SELECT s.learning_context, c.id, c.name, c.grade, c.institution, c.education_level
        FROM students s LEFT JOIN courses c ON c.id = s.course_id AND s.learning_context <> 'preicfes'
          AND LOWER(CONCAT(COALESCE(c.name,''), ' ', COALESCE(c.institution,''))) NOT LIKE '%preicfes%'
          AND LOWER(CONCAT(COALESCE(c.name,''), ' ', COALESCE(c.institution,''))) NOT LIKE '%crecer%'
        WHERE s.id = ? LIMIT 1`, [student.id]);
      const [preicfes] = await pool.query(`SELECT e.id AS enrollment_id, e.provider_institution, e.enrolled_at,
        c.id AS course_id, c.name AS course_name, c.grade, c.education_level
        FROM prueba_saber_course_enrollments e JOIN courses c ON c.id = e.course_id
        WHERE e.student_id = ? AND e.status = 'active' ORDER BY e.enrolled_at DESC`, [student.id]);
      return res.json({ success: true, data: { school: schoolRows[0]?.id ? schoolRows[0] : null, preicfes } });
    }
    if (req.user.role === 'docente') {
      const [teachers] = await pool.query('SELECT id FROM teachers WHERE user_id = ? LIMIT 1', [req.user.id]);
      if (!teachers.length) return res.json({ success: true, data: { school: [], preicfes: [] } });
      const [courses] = await pool.query(`SELECT c.id AS course_id, c.name AS course_name, c.grade,
        c.institution, c.education_level, tc.role
        FROM teacher_courses tc JOIN courses c ON c.id = tc.course_id
        WHERE tc.teacher_id = ? ORDER BY c.institution, c.name`, [teachers[0].id]);
      const isPreicfes = (course) => /crecer|pre.?icfes/i.test(`${course.institution || ''} ${course.course_name || ''} ${course.education_level || ''}`);
      return res.json({ success: true, data: { school: courses.filter((course) => !isPreicfes(course)), preicfes: courses.filter(isPreicfes) } });
    }
    if (elevatedRoles.has(req.user.role)) {
      const [preicfes] = await pool.query(`SELECT c.id AS course_id, c.name AS course_name, c.grade, c.institution
        FROM courses c WHERE LOWER(CONCAT(COALESCE(c.institution,''), ' ', c.name)) LIKE '%crecer%'
        OR LOWER(CONCAT(COALESCE(c.institution,''), ' ', c.name)) LIKE '%preicfes%' ORDER BY c.name`);
      return res.json({ success: true, data: { school: [], preicfes } });
    }
    return res.status(403).json({ success: false, message: 'No tienes permiso para consultar contextos.' });
  } catch (error) {
    console.error('Error consultando contextos educativos:', error);
    return res.status(500).json({ success: false, message: 'No se pudieron cargar los contextos.' });
  }
});

router.get('/applications', verifyToken, async (req, res) => {
  try {
    const role = req.user.role;
    let sql = `SELECT a.*, q.subject, q.grade, q.prueba_saber_level, q.title AS questionnaire_title,
      c.name AS course_name, (SELECT COUNT(*) FROM prueba_saber_application_attempts x WHERE x.application_id = a.id AND x.status IN ('submitted','expired') AND x.score IS NOT NULL) AS completed_count
      FROM prueba_saber_applications a JOIN questionnaires q ON q.id = a.questionnaire_id JOIN courses c ON c.id = a.course_id`;
    const params = [];
    let coverage = null;
    if (role === 'estudiante') {
      const student = await studentForUser(req.user.id);
      if (!student) return res.json({ success: true, data: [] });
      sql += ` WHERE a.status = 'active' AND (a.course_id = ? OR EXISTS (
        SELECT 1 FROM prueba_saber_course_enrollments e WHERE e.student_id = ? AND e.course_id = a.course_id AND e.status = 'active'
      ))`;
      params.push(student.course_id, student.id);
    } else if (role === 'docente') {
      sql += ' WHERE a.created_by_user_id = ?'; params.push(req.user.id);
    } else if (!elevatedRoles.has(role)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para consultar aplicaciones Saber.' });
    }
    sql += ' ORDER BY a.created_at DESC';
    const [rows] = await pool.query(sql, params);
    if (role === 'estudiante') {
      const student = await studentForUser(req.user.id);
      const [attempts] = await pool.query("SELECT application_id, score, correct_count, total_questions, submitted_at FROM prueba_saber_application_attempts WHERE student_id = ? AND status IN ('submitted','expired') AND score IS NOT NULL", [student.id]);
      const byApp = new Map(attempts.map((row) => [Number(row.application_id), row]));
      rows.forEach((row) => { row.attempt = byApp.get(Number(row.id)) || null; });
      const completedIds = rows.filter((row) => row.attempt).flatMap((row) => JSON.parse(row.question_ids_json || '[]').map(Number));
      const allIds = [...new Set(rows.flatMap((row) => JSON.parse(row.question_ids_json || '[]').map(Number)))];
      coverage = { completed_questions: new Set(completedIds).size, assigned_questions: allIds.length };
    } else if (rows.length) {
      const applicationIds = rows.map((row) => Number(row.id));
      const marks = applicationIds.map(() => '?').join(',');
      const [attempts] = await pool.query(`SELECT x.application_id, x.student_id, u.name AS student_name, x.score,
        x.correct_count, x.total_questions, x.submitted_at
        FROM prueba_saber_application_attempts x JOIN students s ON s.id = x.student_id JOIN users u ON u.id = s.user_id
        WHERE x.application_id IN (${marks}) AND x.status IN ('submitted','expired') AND x.score IS NOT NULL ORDER BY x.submitted_at DESC`, applicationIds);
      const byApplication = new Map();
      attempts.forEach((attempt) => {
        const id = Number(attempt.application_id);
        if (!byApplication.has(id)) byApplication.set(id, []);
        byApplication.get(id).push(attempt);
      });
      rows.forEach((row) => { row.results = byApplication.get(Number(row.id)) || []; });
    }
    res.json({ success: true, data: rows, coverage });
  } catch (error) {
    console.error('Error listando aplicaciones Prueba Saber:', error);
    res.status(500).json({ success: false, message: 'No se pudieron cargar las aplicaciones.' });
  }
});

router.post('/applications', verifyToken, async (req, res) => {
  const { questionnaire_id, course_id, title, question_ids, time_limit_minutes, institution } = req.body || {};
  const ids = [...new Set((Array.isArray(question_ids) ? question_ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const minutes = time_limit_minutes === '' || time_limit_minutes == null ? null : Number(time_limit_minutes);
  if (!staffRoles.has(req.user.role)) return res.status(403).json({ success: false, message: 'Solo el equipo docente puede crear aplicaciones.' });
  if (!ids.length || !title?.trim() || !Number.isInteger(Number(course_id)) || (minutes !== null && (!Number.isInteger(minutes) || minutes < 1))) {
    return res.status(400).json({ success: false, message: 'Indica título, curso, preguntas y un tiempo válido.' });
  }
  try {
    const [questionnaires] = await pool.query('SELECT id, created_by, is_prueba_saber FROM questionnaires WHERE id = ? LIMIT 1', [questionnaire_id]);
    if (!questionnaires.length || !questionnaires[0].is_prueba_saber) return res.status(400).json({ success: false, message: 'El banco debe ser un cuestionario marcado como Prueba Saber.' });
    const [courses] = await pool.query('SELECT id FROM courses WHERE id = ?', [course_id]);
    if (!courses.length) return res.status(400).json({ success: false, message: 'El curso seleccionado no existe.' });
    if (req.user.role === 'docente') {
      const [teachers] = await pool.query('SELECT id FROM teachers WHERE user_id = ? LIMIT 1', [req.user.id]);
      if (teachers.length) {
        const [courseAssignments] = await pool.query('SELECT id FROM teacher_courses WHERE teacher_id = ? AND course_id = ? LIMIT 1', [teachers[0].id, course_id]);
        if (!courseAssignments.length) return res.status(403).json({ success: false, message: 'Solo puedes asignar pruebas a cursos vinculados a tu perfil docente.' });
      }
      if (!teachers.length || Number(questionnaires[0].created_by) !== Number(teachers[0].id)) return res.status(403).json({ success: false, message: 'Solo puedes crear aplicaciones con bancos de tu autoría.' });
    }
    const marks = ids.map(() => '?').join(',');
    const [questions] = await pool.query(`SELECT id FROM questions WHERE questionnaire_id = ? AND id IN (${marks})`, [questionnaire_id, ...ids]);
    if (questions.length !== ids.length) return res.status(400).json({ success: false, message: 'Todas las preguntas deben pertenecer al cuestionario Saber seleccionado.' });
    let providerInstitution = String(institution || 'CRECER').trim().slice(0, 150) || 'CRECER';
    if (req.user.role === 'docente') {
      const [userRows] = await pool.query('SELECT institution FROM users WHERE id = ? LIMIT 1', [req.user.id]);
      providerInstitution = String(institution || userRows[0]?.institution || 'Preicfes').trim().slice(0, 150) || 'Preicfes';
    }
    const [result] = await pool.query(`INSERT INTO prueba_saber_applications
      (questionnaire_id, course_id, title, question_ids_json, time_limit_minutes, created_by_user_id, institution)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [questionnaire_id, course_id, title.trim(), JSON.stringify(ids), minutes, req.user.id, providerInstitution]);
    res.status(201).json({ success: true, data: await getApplication(result.insertId) });
  } catch (error) {
    console.error('Error creando aplicación Prueba Saber:', error);
    res.status(500).json({ success: false, message: 'No se pudo crear la aplicación.' });
  }
});

router.post('/enrollment-codes', verifyToken, async (req, res) => {
  const { course_id, max_uses, expires_at } = req.body || {};
  if (!staffRoles.has(req.user.role)) return res.status(403).json({ success: false, message: 'Solo el equipo docente puede crear códigos.' });
  if (!Number.isInteger(Number(course_id))) return res.status(400).json({ success: false, message: 'Selecciona un curso Preicfes.' });
  const limit = max_uses === '' || max_uses == null ? null : Number(max_uses);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 10000)) return res.status(400).json({ success: false, message: 'El límite debe ser un número entre 1 y 10000, o estar vacío para no limitarlo.' });
  try {
    const [courses] = await pool.query('SELECT id, name, institution FROM courses WHERE id = ? LIMIT 1', [course_id]);
    const course = courses[0];
    if (!course || !isPreicfesCourse(course)) return res.status(400).json({ success: false, message: 'El curso seleccionado no es un curso Preicfes.' });
    if (req.user.role === 'docente') {
      const [teachers] = await pool.query('SELECT id FROM teachers WHERE user_id = ? LIMIT 1', [req.user.id]);
      const [assigned] = teachers.length ? await pool.query('SELECT id FROM teacher_courses WHERE teacher_id = ? AND course_id = ? LIMIT 1', [teachers[0].id, course_id]) : [[]];
      if (!assigned.length) return res.status(403).json({ success: false, message: 'Solo puedes crear códigos para tus cursos asignados.' });
    }
    let expiry = null;
    if (expires_at) {
      const parsed = new Date(expires_at);
      if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) return res.status(400).json({ success: false, message: 'La fecha de vencimiento debe estar en el futuro.' });
      expiry = parsed;
    }
    const code = randomBytes(6).toString('hex').toUpperCase();
    const [result] = await pool.query(`INSERT INTO prueba_saber_enrollment_codes
      (code_hash, course_id, created_by_user_id, max_uses, expires_at, active)
      VALUES (?, ?, ?, ?, ?, 1)`, [hashEnrollmentCode(code), course_id, req.user.id, limit, expiry]);
    return res.status(201).json({ success: true, code, data: { id: result.insertId, course_id: Number(course_id), course_name: course.name, max_uses: limit, expires_at: expiry } });
  } catch (error) {
    console.error('Error creando código de matrícula Preicfes:', error);
    return res.status(500).json({ success: false, message: 'No se pudo crear el código. Verifica que esté aplicada la migración de códigos.' });
  }
});

router.get('/enrollment-codes', verifyToken, async (req, res) => {
  if (!staffRoles.has(req.user.role)) return res.status(403).json({ success: false, message: 'No tienes permiso para consultar códigos.' });
  try {
    let sql = `SELECT ec.id, ec.course_id, c.name AS course_name, ec.max_uses, ec.use_count, ec.expires_at, ec.active, ec.created_at
      FROM prueba_saber_enrollment_codes ec JOIN courses c ON c.id = ec.course_id`;
    const params = [];
    if (req.user.role === 'docente') {
      const [teachers] = await pool.query('SELECT id FROM teachers WHERE user_id = ? LIMIT 1', [req.user.id]);
      if (!teachers.length) return res.json({ success: true, data: [] });
      sql += ' JOIN teacher_courses tc ON tc.course_id = c.id WHERE tc.teacher_id = ?'; params.push(teachers[0].id);
    }
    sql += ' ORDER BY ec.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error listando códigos Preicfes:', error);
    res.status(500).json({ success: false, message: 'No se pudieron cargar los códigos.' });
  }
});

router.patch('/enrollment-codes/:id/revoke', verifyToken, async (req, res) => {
  if (!staffRoles.has(req.user.role)) return res.status(403).json({ success: false, message: 'No tienes permiso para revocar códigos.' });
  try {
    let sql = `UPDATE prueba_saber_enrollment_codes ec JOIN courses c ON c.id = ec.course_id SET ec.active = 0 WHERE ec.id = ?`;
    const params = [req.params.id];
    if (req.user.role === 'docente') {
      const [teachers] = await pool.query('SELECT id FROM teachers WHERE user_id = ? LIMIT 1', [req.user.id]);
      if (!teachers.length) return res.status(403).json({ success: false, message: 'Perfil docente no encontrado.' });
      sql += ' AND EXISTS (SELECT 1 FROM teacher_courses tc WHERE tc.teacher_id = ? AND tc.course_id = c.id)'; params.push(teachers[0].id);
    }
    const [result] = await pool.query(sql, params);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Código no encontrado o fuera de tus cursos.' });
    res.json({ success: true, message: 'Código revocado.' });
  } catch (error) {
    console.error('Error revocando código Preicfes:', error);
    res.status(500).json({ success: false, message: 'No se pudo revocar el código.' });
  }
});

router.post('/enrollment-codes/redeem', verifyToken, async (req, res) => {
  if (req.user.role !== 'estudiante') return res.status(403).json({ success: false, message: 'Solo los estudiantes pueden canjear códigos.' });
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(code)) return res.status(400).json({ success: false, message: 'Escribe un código de matrícula válido.' });
  const connection = await pool.getConnection();
  try {
    const student = await studentForUser(req.user.id);
    if (!student) { connection.release(); return res.status(404).json({ success: false, message: 'No encontramos el perfil de estudiante.' }); }
    await connection.beginTransaction();
    await connection.query('SELECT id FROM students WHERE id = ? FOR UPDATE', [student.id]);
    const [codes] = await connection.query(`SELECT ec.*, c.name AS course_name, c.institution
      FROM prueba_saber_enrollment_codes ec JOIN courses c ON c.id = ec.course_id
      WHERE ec.code_hash = ? FOR UPDATE`, [hashEnrollmentCode(code)]);
    const enrollmentCode = codes[0];
    if (!enrollmentCode || !enrollmentCode.active) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'El código no existe o fue desactivado.' });
    }
    if (enrollmentCode.expires_at && new Date(enrollmentCode.expires_at) <= new Date()) {
      await connection.rollback();
      return res.status(410).json({ success: false, message: 'El código venció.' });
    }
    if (enrollmentCode.max_uses !== null && Number(enrollmentCode.use_count) >= Number(enrollmentCode.max_uses)) {
      await connection.rollback();
      return res.status(410).json({ success: false, message: 'El código ya alcanzó el límite de matrículas.' });
    }
    const [existing] = await connection.query("SELECT id FROM prueba_saber_course_enrollments WHERE student_id = ? AND course_id = ? AND status = 'active' LIMIT 1", [student.id, enrollmentCode.course_id]);
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Ya tienes una matrícula activa en este curso.' });
    }
    const provider = String(enrollmentCode.institution || 'Preicfes').trim() || 'Preicfes';
    const profileProgram = /crecer/i.test(provider) ? 'CRECER' : 'Preicfes independiente';
    await connection.query(`INSERT INTO prueba_saber_course_enrollments (student_id, course_id, provider_institution, status)
      VALUES (?, ?, ?, 'active') ON DUPLICATE KEY UPDATE status = 'active', provider_institution = VALUES(provider_institution)`, [student.id, enrollmentCode.course_id, provider]);
    await connection.query(`UPDATE students SET learning_context = 'preicfes', preicfes_program = ?
      WHERE id = ? AND learning_context <> 'preicfes' AND grade IS NULL AND course_id IS NULL
        AND (institution IS NULL OR TRIM(institution) = '')`, [profileProgram, student.id]);
    await connection.query('UPDATE prueba_saber_enrollment_codes SET use_count = use_count + 1 WHERE id = ?', [enrollmentCode.id]);
    await connection.commit();
    return res.status(201).json({ success: true, message: `Matrícula realizada en ${enrollmentCode.course_name}.`, data: { course_id: enrollmentCode.course_id, course_name: enrollmentCode.course_name } });
  } catch (error) {
    await connection.rollback();
    console.error('Error canjeando código Preicfes:', error);
    res.status(500).json({ success: false, message: 'No se pudo completar la matrícula.' });
  } finally { connection.release(); }
});

router.post('/enrollments', verifyToken, async (req, res) => {
  if (!elevatedRoles.has(req.user.role)) return res.status(403).json({ success: false, message: 'Solo administradores pueden registrar matrículas Preicfes.' });
  const { student_id, course_id } = req.body || {};
  if (!Number.isInteger(Number(student_id)) || !Number.isInteger(Number(course_id))) return res.status(400).json({ success: false, message: 'Indica el estudiante y el curso Preicfes.' });
  try {
    const [studentRows] = await pool.query('SELECT id FROM students WHERE id = ?', [student_id]);
    const [courseRows] = await pool.query('SELECT id FROM courses WHERE id = ?', [course_id]);
    if (!studentRows.length || !courseRows.length) return res.status(404).json({ success: false, message: 'No se encontró el estudiante o el curso.' });
    await pool.query(`INSERT INTO prueba_saber_course_enrollments (student_id, course_id, provider_institution, status)
      VALUES (?, ?, 'CRECER', 'active') ON DUPLICATE KEY UPDATE status = 'active', provider_institution = 'CRECER'`, [student_id, course_id]);
    res.status(201).json({ success: true, message: 'Matrícula Preicfes CRECER registrada. La institución de origen del estudiante se conserva.' });
  } catch (error) {
    console.error('Error registrando matrícula Preicfes:', error);
    res.status(500).json({ success: false, message: 'No se pudo registrar la matrícula Preicfes.' });
  }
});

router.get('/applications/:id', verifyToken, async (req, res) => {
  try {
    if (!staffRoles.has(req.user.role) && req.user.role !== 'estudiante') return res.status(403).json({ success: false, message: 'No tienes permiso para consultar esta aplicación.' });
    const application = await getApplication(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Aplicación no encontrada.' });
    const student = req.user.role === 'estudiante' ? await studentForUser(req.user.id) : null;
    if (req.user.role === 'estudiante' && (!(await studentHasCourse(student, application.course_id)) || application.status !== 'active')) return res.status(403).json({ success: false, message: 'Esta aplicación no está asignada a tu curso.' });
    if (req.user.role === 'docente' && Number(application.created_by_user_id) !== Number(req.user.id)) return res.status(403).json({ success: false, message: 'No tienes acceso a esta aplicación.' });
    let attempt = null;
    if (student) {
      const [attempts] = await pool.query("SELECT *, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS remaining_seconds FROM prueba_saber_application_attempts WHERE application_id = ? AND student_id = ? LIMIT 1", [application.id, student.id]);
      attempt = attempts[0] || null;
      if (!attempt) return res.status(409).json({ success: false, message: 'Inicia la aplicación desde tu lista de pruebas.' });
      if (attempt?.status === 'submitted' || (attempt?.status === 'expired' && attempt.score !== null)) return res.json({ success: true, data: { application, attempt, questions: [] } });
      if (attempt?.status === 'expired') return res.status(410).json({ success: false, message: 'El tiempo venció y no había respuestas guardadas para calificar.' });
      if (attempt?.status === 'in_progress' && attempt.expires_at && Number(attempt.remaining_seconds) < -10) {
        const ids = JSON.parse(application.question_ids_json || '[]').map(Number);
        const savedAnswers = JSON.parse(attempt.answers_json || '{}');
        const marks = ids.map(() => '?').join(',');
        const [correctQuestions] = await pool.query(`SELECT id, correct_answer FROM questions WHERE id IN (${marks})`, ids);
        const correctById = new Map(correctQuestions.map((q) => [String(q.id), q.correct_answer]));
        const graded = gradeAnswers(ids, savedAnswers, correctById);
        await pool.query("UPDATE prueba_saber_application_attempts SET status = 'expired', score = ?, correct_count = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?", [graded.score, graded.correct, attempt.id]);
        return res.json({ success: true, data: { application, attempt: { ...attempt, score: graded.score, correct_count: graded.correct, total_questions: ids.length, status: 'expired' }, questions: [] } });
      }
    }
    const ids = JSON.parse(application.question_ids_json || '[]');
    if (!ids.length) return res.status(404).json({ success: false, message: 'La aplicación no tiene preguntas.' });
    const marks = ids.map(() => '?').join(',');
    const [questions] = await pool.query(`SELECT id, question_text, option1, option2, option3, option4, image_url FROM questions WHERE id IN (${marks})`, ids);
    const byId = new Map(questions.map((q) => [Number(q.id), q]));
    res.json({ success: true, data: { application, attempt, questions: ids.map((id) => byId.get(Number(id))).filter(Boolean) } });
  } catch (error) {
    console.error('Error cargando aplicación Prueba Saber:', error);
    res.status(500).json({ success: false, message: 'No se pudo cargar la aplicación.' });
  }
});

router.put('/applications/:id/progress', verifyToken, async (req, res) => {
  if (req.user.role !== 'estudiante') return res.status(403).json({ success: false, message: 'Solo un estudiante puede guardar su progreso.' });
  try {
    const student = await studentForUser(req.user.id);
    const application = await getApplication(req.params.id);
    if (!student || !application || !(await studentHasCourse(student, application.course_id))) return res.status(403).json({ success: false, message: 'Aplicación no disponible para tu curso.' });
    const [attempts] = await pool.query("SELECT id, status, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS remaining_seconds FROM prueba_saber_application_attempts WHERE application_id = ? AND student_id = ? LIMIT 1", [application.id, student.id]);
    if (!attempts.length || attempts[0].status !== 'in_progress') return res.status(409).json({ success: false, message: 'No hay una aplicación activa.' });
    if (attempts[0].remaining_seconds !== null && Number(attempts[0].remaining_seconds) < -10) return res.status(410).json({ success: false, message: 'Se agotó el tiempo de esta aplicación.' });
    const ids = new Set(JSON.parse(application.question_ids_json || '[]').map(String));
    const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const filtered = Object.fromEntries(Object.entries(answers).filter(([id]) => ids.has(String(id))));
    await pool.query('UPDATE prueba_saber_application_attempts SET answers_json = ? WHERE id = ?', [JSON.stringify(filtered), attempts[0].id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error guardando progreso Saber:', error);
    res.status(500).json({ success: false, message: 'No se pudo guardar el progreso.' });
  }
});

router.post('/applications/:id/start', verifyToken, async (req, res) => {
  if (req.user.role !== 'estudiante') return res.status(403).json({ success: false, message: 'Solo estudiantes pueden iniciar una aplicación.' });
  try {
    const student = await studentForUser(req.user.id);
    const application = await getApplication(req.params.id);
    if (!student || !application || application.status !== 'active' || !(await studentHasCourse(student, application.course_id))) return res.status(403).json({ success: false, message: 'Aplicación no disponible para tu curso.' });
    const [existing] = await pool.query('SELECT id, status FROM prueba_saber_application_attempts WHERE application_id = ? AND student_id = ?', [application.id, student.id]);
    if (existing.length) return res.json({ success: true, message: 'La aplicación ya fue iniciada.', status: existing[0].status });
    const ids = JSON.parse(application.question_ids_json || '[]');
    if (!ids.length) return res.status(400).json({ success: false, message: 'La aplicación no tiene preguntas.' });
    const minutes = Number(application.time_limit_minutes) || null;
    await pool.query(`INSERT INTO prueba_saber_application_attempts (application_id, student_id, total_questions, status, expires_at)
      VALUES (?, ?, ?, 'in_progress', ${minutes ? 'DATE_ADD(NOW(), INTERVAL ? MINUTE)' : 'NULL'})`, minutes ? [application.id, student.id, ids.length, minutes] : [application.id, student.id, ids.length]);
    res.status(201).json({ success: true, message: 'Aplicación iniciada.' });
  } catch (error) {
    console.error('Error iniciando aplicación Prueba Saber:', error);
    res.status(500).json({ success: false, message: 'No se pudo iniciar la aplicación.' });
  }
});

router.post('/applications/:id/submit', verifyToken, async (req, res) => {
  if (req.user.role !== 'estudiante') return res.status(403).json({ success: false, message: 'Solo un estudiante puede enviar respuestas.' });
  const connection = await pool.getConnection();
  try {
    const student = await studentForUser(req.user.id);
    const application = await getApplication(req.params.id);
    if (!student || !application || application.status !== 'active' || !(await studentHasCourse(student, application.course_id))) return res.status(403).json({ success: false, message: 'Aplicación no disponible para tu curso.' });
    const ids = JSON.parse(application.question_ids_json || '[]').map(Number);
    const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const [existing] = await connection.query('SELECT id FROM prueba_saber_application_attempts WHERE application_id = ? AND student_id = ?', [application.id, student.id]);
    if (!existing.length) return res.status(409).json({ success: false, message: 'Primero debes iniciar la aplicación.' });
    const [sessionRows] = await connection.query("SELECT status, expires_at, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS remaining_seconds FROM prueba_saber_application_attempts WHERE id = ?", [existing[0].id]);
    if (sessionRows[0]?.status !== 'in_progress') return res.status(409).json({ success: false, message: 'Esta aplicación ya fue enviada o venció.' });
    if (sessionRows[0].expires_at && Number(sessionRows[0].remaining_seconds) < -10) {
      return res.status(410).json({ success: false, message: 'Se agotó el tiempo de esta aplicación.' });
    }
    const marks = ids.map(() => '?').join(',');
    const [questions] = await connection.query(`SELECT id, correct_answer FROM questions WHERE id IN (${marks})`, ids);
    const valid = new Map(questions.map((q) => [String(q.id), q.correct_answer]));
    if (valid.size !== ids.length) return res.status(409).json({ success: false, message: 'El banco cambió desde que se creó esta aplicación.' });
    const graded = gradeAnswers(ids, answers, valid);
    await connection.beginTransaction();
    await connection.query(`UPDATE prueba_saber_application_attempts SET answers_json = ?, score = ?, correct_count = ?, total_questions = ?, status = 'submitted', submitted_at = CURRENT_TIMESTAMP
      WHERE id = ?`, [JSON.stringify(answers), graded.score, graded.correct, ids.length, existing[0].id]);
    await connection.commit();
    res.json({ success: true, data: { score: graded.score, correct_count: graded.correct, total_questions: ids.length, answered_count: ids.filter((id) => answers[id]).length, status: 'submitted' } });
  } catch (error) {
    await connection.rollback();
    console.error('Error calificando aplicación Prueba Saber:', error);
    res.status(500).json({ success: false, message: 'No se pudo guardar el resultado.' });
  } finally { connection.release(); }
});

export default router;
