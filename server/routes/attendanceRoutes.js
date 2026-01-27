import { Router } from 'express';
import crypto from 'crypto';
import pool from '../config/db.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';

const router = Router();
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomShortCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

async function ensureUniqueShortCode() {
  for (let i = 0; i < 50; i++) {
    const code = randomShortCode();
    const [r] = await pool.query('SELECT 1 FROM attendance_sessions WHERE short_code = ?', [code]);
    if (!r.length) return code;
  }
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Crear sesión de asistencia (docente/admin)
router.post('/sessions', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const teacherId = req.user.teacher_id;
    if (!teacherId && req.user.role !== 'administrador' && req.user.role !== 'super_administrador') {
      return res.status(403).json({ success: false, message: 'Solo docentes pueden crear sesiones de asistencia.' });
    }
    let tid = teacherId;
    if ((req.user.role === 'administrador' || req.user.role === 'super_administrador') && req.body.teacher_id != null) {
      tid = Number(req.body.teacher_id);
    }
    if (!tid) return res.status(400).json({ success: false, message: 'teacher_id requerido.' });

    const { name, session_date, grade, course_id } = req.body;
    const sessionDate = session_date || new Date().toISOString().slice(0, 10);
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(sessionDate);
    if (!valid) return res.status(400).json({ success: false, message: 'session_date inválido (YYYY-MM-DD).' });

    const token = crypto.randomBytes(24).toString('hex');
    const shortCode = await ensureUniqueShortCode();
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
    await pool.query(
      `INSERT INTO attendance_sessions (teacher_id, name, session_date, grade, course_id, token, short_code, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tid, name || null, sessionDate, grade || null, course_id ?? null, token, shortCode, expiresAt]
    );
    const [[row]] = await pool.query('SELECT * FROM attendance_sessions WHERE token = ?', [token]);
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    console.error('Error creating attendance session:', e);
    res.status(500).json({ success: false, message: 'Error al crear sesión.' });
  }
});

// Listar sesiones del docente
router.get('/sessions', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const teacherId = req.user.teacher_id;
    const isAdmin = req.user.role === 'administrador' || req.user.role === 'super_administrador';
    if (!isAdmin && !teacherId) return res.json({ success: true, data: [] });
    let tid = teacherId;
    if (isAdmin && req.query.teacher_id != null) tid = Number(req.query.teacher_id);
    if (tid == null || tid === '') return res.json({ success: true, data: [] });
    const [rows] = await pool.query(
      `SELECT s.*, t.user_id as teacher_user_id
       FROM attendance_sessions s
       JOIN teachers t ON t.id = s.teacher_id
       WHERE s.teacher_id = ?
       ORDER BY s.session_date DESC, s.created_at DESC
       LIMIT 200`,
      [tid]
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    console.error('Error listing attendance sessions:', e);
    res.status(500).json({ success: false, message: 'Error al listar sesiones.' });
  }
});

// Obtener una sesión y sus registros
router.get('/sessions/:id', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [sessions] = await pool.query('SELECT * FROM attendance_sessions WHERE id = ?', [id]);
    if (!sessions.length) return res.status(404).json({ success: false, message: 'Sesión no encontrada.' });
    const session = sessions[0];
    const isAdmin = req.user.role === 'administrador' || req.user.role === 'super_administrador';
    if (!isAdmin && session.teacher_id !== req.user.teacher_id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver esta sesión.' });
    }
    const [records] = await pool.query(
      `SELECT ar.*, u.name as student_name
       FROM attendance_records ar
       JOIN students st ON st.id = ar.student_id
       JOIN users u ON u.id = st.user_id
       WHERE ar.session_id = ?
       ORDER BY u.name`,
      [id]
    );
    res.json({ success: true, data: { ...session, records } });
  } catch (e) {
    console.error('Error fetching attendance session:', e);
    res.status(500).json({ success: false, message: 'Error al obtener sesión.' });
  }
});

// Grados y cursos del docente (para filtros al crear sesión / registro manual)
router.get('/filters', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const teacherId = req.user.teacher_id;
    const isAdmin = req.user.role === 'administrador' || req.user.role === 'super_administrador';
    if (!isAdmin && !teacherId) return res.json({ success: true, data: { grades: [], courses: [] } });
    let tid = teacherId;
    if (isAdmin && req.query.teacher_id != null) tid = Number(req.query.teacher_id);
    if (tid == null || tid === '') return res.json({ success: true, data: { grades: [], courses: [] } });
    const [g] = await pool.query(
      `SELECT DISTINCT s.grade FROM teacher_students ts
       JOIN students s ON s.id = ts.student_id WHERE ts.teacher_id = ? AND s.grade IS NOT NULL AND s.grade != ''
       ORDER BY s.grade`,
      [tid]
    );
    const [c] = await pool.query(
      `SELECT DISTINCT c.id, c.name FROM teacher_students ts
       JOIN students s ON s.id = ts.student_id
       LEFT JOIN courses c ON c.id = s.course_id
       WHERE ts.teacher_id = ? AND c.id IS NOT NULL
       ORDER BY c.name`,
      [tid]
    );
    res.json({ success: true, data: { grades: g.map((r) => r.grade), courses: c } });
  } catch (e) {
    console.error('Error fetching attendance filters:', e);
    res.status(500).json({ success: false, message: 'Error al obtener filtros.' });
  }
});

// Estudiantes por grado/curso (para registro manual). Query: teacher_id, grade, course_id
router.get('/students', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const teacherId = req.user.teacher_id;
    const isAdmin = req.user.role === 'administrador' || req.user.role === 'super_administrador';
    if (!isAdmin && !teacherId) return res.json({ success: true, data: [] });
    let tid = teacherId;
    if (isAdmin && req.query.teacher_id != null) tid = Number(req.query.teacher_id);
    if (tid == null || tid === '') return res.json({ success: true, data: [] });
    const { grade, course_id } = req.query;
    let sql = `
      SELECT DISTINCT s.id, s.user_id, s.grade, s.course_id, u.name as student_name, c.name as course_name
      FROM teacher_students ts
      JOIN students s ON s.id = ts.student_id
      JOIN users u ON u.id = s.user_id
      LEFT JOIN courses c ON c.id = s.course_id
      WHERE ts.teacher_id = ?
    `;
    const params = [tid];
    if (grade != null && grade !== '') {
      sql += ' AND s.grade = ?';
      params.push(grade);
    }
    if (course_id != null && course_id !== '') {
      sql += ' AND s.course_id = ?';
      params.push(course_id);
    }
    sql += ' ORDER BY s.grade, c.name, u.name';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (e) {
    console.error('Error listing students for attendance:', e);
    res.status(500).json({ success: false, message: 'Error al listar estudiantes.' });
  }
});

// Registrar asistencia manual (bulk)
router.post('/records', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { session_id, records } = req.body;
    if (!session_id || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'session_id y records[] requeridos.' });
    }
    const [sessions] = await pool.query('SELECT teacher_id FROM attendance_sessions WHERE id = ?', [session_id]);
    if (!sessions.length) return res.status(404).json({ success: false, message: 'Sesión no encontrada.' });
    const isAdmin = req.user.role === 'administrador' || req.user.role === 'super_administrador';
    if (!isAdmin && sessions[0].teacher_id !== req.user.teacher_id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para registrar en esta sesión.' });
    }

    for (const r of records) {
      const studentId = Number(r.student_id);
      const status = r.status === 'absent' ? 'absent' : 'present';
      if (!studentId) continue;
      await pool.query(
        `INSERT INTO attendance_records (session_id, student_id, status, source, registered_at)
         VALUES (?, ?, ?, 'manual', NOW())
         ON DUPLICATE KEY UPDATE status = VALUES(status), source = 'manual', registered_at = NOW()`,
        [session_id, studentId, status]
      );
    }
    const [recs] = await pool.query(
      `SELECT ar.*, u.name as student_name
       FROM attendance_records ar
       JOIN students st ON st.id = ar.student_id
       JOIN users u ON u.id = st.user_id
       WHERE ar.session_id = ? ORDER BY u.name`,
      [session_id]
    );
    res.json({ success: true, data: recs });
  } catch (e) {
    console.error('Error saving attendance records:', e);
    res.status(500).json({ success: false, message: 'Error al guardar asistencia.' });
  }
});

// --- Validación QR / código (estudiante) ---

// GET info sesión por token (público para mostrar en página de escaneo)
router.get('/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const [rows] = await pool.query(
      `SELECT id, teacher_id, name, session_date, grade, course_id, token, short_code, expires_at
       FROM attendance_sessions WHERE token = ?`,
      [token]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Sesión no encontrada.' });
    const s = rows[0];
    if (new Date(s.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'Esta sesión de asistencia ya expiró.' });
    }
    res.json({ success: true, data: s });
  } catch (e) {
    console.error('Error validating token:', e);
    res.status(500).json({ success: false, message: 'Error al validar.' });
  }
});

// GET sesión por short_code (público)
router.get('/validate/by-code/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const [rows] = await pool.query(
      `SELECT id, teacher_id, name, session_date, grade, course_id, token, short_code, expires_at
       FROM attendance_sessions WHERE short_code = ?`,
      [code]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Código no encontrado.' });
    const s = rows[0];
    if (new Date(s.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'Esta sesión de asistencia ya expiró.' });
    }
    res.json({ success: true, data: s });
  } catch (e) {
    console.error('Error validating code:', e);
    res.status(500).json({ success: false, message: 'Error al validar.' });
  }
});

// POST registrar asistencia vía QR/código (estudiante autenticado)
router.post('/validate/:token', verifyToken, async (req, res) => {
  try {
    const studentId = req.user.student_id;
    if (!studentId) return res.status(403).json({ success: false, message: 'Solo estudiantes pueden marcar asistencia por QR.' });

    const { token } = req.params;
    const [rows] = await pool.query(
      'SELECT id, teacher_id, expires_at FROM attendance_sessions WHERE token = ?',
      [token]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Sesión no encontrada.' });
    const s = rows[0];
    if (new Date(s.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'Esta sesión de asistencia ya expiró.' });
    }

    const [rel] = await pool.query(
      'SELECT 1 FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
      [s.teacher_id, studentId]
    );
    if (!rel.length) {
      return res.status(403).json({ success: false, message: 'No estás asignado a este profesor para esta sesión.' });
    }

    await pool.query(
      `INSERT INTO attendance_records (session_id, student_id, status, source, registered_at)
       VALUES (?, ?, 'present', 'qr', NOW())
       ON DUPLICATE KEY UPDATE status = 'present', source = 'qr', registered_at = NOW()`,
      [s.id, studentId]
    );
    res.json({ success: true, message: 'Asistencia registrada.' });
  } catch (e) {
    console.error('Error registering attendance via QR:', e);
    res.status(500).json({ success: false, message: 'Error al registrar asistencia.' });
  }
});

export default router;
