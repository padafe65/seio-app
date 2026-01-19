// routes/educationalResources.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin, isTeacherOrAdmin, isSuperAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// RUTAS PARA ESTUDIANTES (Solo lectura)
// ==========================================

/**
 * GET /api/educational-resources
 * Obtener todos los recursos educativos activos (para estudiantes)
 * Query params: subject, area, grade_level, phase, difficulty, resource_type
 */
router.get('/', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { 
      subject,
      subjects, // Para múltiples materias separadas por comas
      area, 
      grade_level, 
      phase, 
      difficulty, 
      resource_type,
      institution_id 
    } = req.query;
    
    let query = `
      SELECT 
        er.id,
        er.subject,
        er.area,
        er.topic,
        er.title,
        er.description,
        er.url,
        er.resource_type,
        er.grade_level,
        er.phase,
        er.difficulty,
        er.views_count,
        er.rating,
        er.created_at,
        u.name as created_by_name
      FROM educational_resources er
      LEFT JOIN users u ON er.created_by = u.id
      WHERE er.is_active = TRUE
    `;
    
    const params = [];
    
    // Filtros opcionales
    // Manejar múltiples materias: puede venir como 'subject' (una sola) o 'subjects' (múltiples separadas por comas)
    if (subjects) {
      // Parsear string separado por comas: "Matemáticas,Español"
      const subjectArray = subjects.split(',').map(s => s.trim()).filter(s => s);
      if (subjectArray.length > 0) {
        const subjectPlaceholders = subjectArray.map(() => '?').join(',');
        query += ` AND er.subject IN (${subjectPlaceholders})`;
        params.push(...subjectArray);
      }
    } else if (subject) {
      // Una sola materia
      query += ` AND er.subject = ?`;
      params.push(subject);
    }
    
    if (area) {
      query += ` AND er.area = ?`;
      params.push(area);
    }
    
    if (grade_level) {
      // Manejar rangos de grados (ej: '6-9', '10-11') y valores exactos
      query += ` AND (
        er.grade_level = ? 
        OR er.grade_level = 'Todos'
        OR (
          er.grade_level LIKE '%-%'
          AND CAST(SUBSTRING_INDEX(er.grade_level, '-', 1) AS UNSIGNED) <= ?
          AND CAST(SUBSTRING_INDEX(er.grade_level, '-', -1) AS UNSIGNED) >= ?
        )
      )`;
      params.push(grade_level, grade_level, grade_level);
    }
    
    if (phase) {
      query += ` AND (er.phase = ? OR er.phase IS NULL)`;
      params.push(phase);
    }
    
    if (difficulty) {
      query += ` AND er.difficulty = ?`;
      params.push(difficulty);
    }
    
    if (resource_type) {
      query += ` AND er.resource_type = ?`;
      params.push(resource_type);
    }
    
    // Filtro por institución (NULL = todas las instituciones)
    if (institution_id) {
      query += ` AND (er.institution_id = ? OR er.institution_id IS NULL)`;
      params.push(institution_id);
    }
    
    query += ` ORDER BY er.subject, er.area, er.title`;
    
    const [resources] = await connection.query(query, params);
    
    // Incrementar contador de visualizaciones (si es estudiante)
    if (req.user.role === 'estudiante' && resources.length > 0) {
      const resourceIds = resources.map(r => r.id);
      if (resourceIds.length > 0) {
        await connection.query(
          `UPDATE educational_resources 
           SET views_count = views_count + 1 
           WHERE id IN (${resourceIds.map(() => '?').join(',')})`,
          resourceIds
        );
      }
    }
    
    res.json({
      success: true,
      count: resources.length,
      data: resources
    });
    
  } catch (error) {
    console.error('❌ Error al obtener recursos educativos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener recursos educativos',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/educational-resources/recommended/:studentId
 * Obtener recursos recomendados para un estudiante
 */
router.get('/recommended/:studentId', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { studentId } = req.params;
    
    // Verificar que el usuario es el estudiante o tiene permisos
    if (req.user.role === 'estudiante' && req.user.student_id !== parseInt(studentId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a estos recursos'
      });
    }
    
    // Obtener información del estudiante
    const [students] = await connection.query(
      `SELECT s.id, s.grade, s.course_id, c.name as course_name
       FROM students s
       LEFT JOIN courses c ON s.course_id = c.id
       WHERE s.id = ?`,
      [studentId]
    );
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado'
      });
    }
    
    const student = students[0];
    
    // Obtener las materias de los docentes asignados al estudiante
    const [teacherSubjectsRows] = await connection.query(`
      SELECT DISTINCT t.subject
      FROM teacher_students ts
      JOIN teachers t ON ts.teacher_id = t.id
      WHERE ts.student_id = ?
        AND t.subject IS NOT NULL
        AND t.subject != ''
    `, [studentId]);
    
    const teacherSubjects = teacherSubjectsRows.map(row => row.subject);
    console.log(`📚 Materias de los docentes del estudiante ${studentId}:`, teacherSubjects);
    
    // Obtener fases donde el estudiante tiene bajas calificaciones
    // La tabla grades tiene columnas phase1, phase2, phase3, phase4, no "phase"
    const [gradesRows] = await connection.query(
      `SELECT phase1, phase2, phase3, phase4 
       FROM grades 
       WHERE student_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [studentId]
    );
    
    // Extraer fases con bajas calificaciones (< 3.0 o NULL)
    const phases = [];
    if (gradesRows.length > 0) {
      const grades = gradesRows[0];
      if (grades.phase1 === null || (grades.phase1 !== null && grades.phase1 < 3.0)) {
        phases.push(1);
      }
      if (grades.phase2 === null || (grades.phase2 !== null && grades.phase2 < 3.0)) {
        phases.push(2);
      }
      if (grades.phase3 === null || (grades.phase3 !== null && grades.phase3 < 3.0)) {
        phases.push(3);
      }
      if (grades.phase4 === null || (grades.phase4 !== null && grades.phase4 < 3.0)) {
        phases.push(4);
      }
    }
    
    // Obtener recursos recomendados
    // Construir condición para grade_level que maneje rangos (ej: "6-9", "10-11", "Todos")
    const studentGrade = student.grade ? parseInt(student.grade) : null;
    let gradeCondition = '';
    const params = [];
    
    if (studentGrade) {
      // Manejar rangos como "6-9", "10-11", etc., y también valores exactos como "7" o "Todos"
      // Si grade_level es "6-9" y el estudiante tiene grado 7, debe incluirse
      // Si grade_level es "7" y el estudiante tiene grado 7, debe incluirse
      // Si grade_level es "Todos", siempre debe incluirse
      gradeCondition = ` AND (
        er.grade_level = 'Todos' 
        OR er.grade_level = ?
        OR (
          er.grade_level LIKE '%-%' 
          AND CAST(SUBSTRING_INDEX(er.grade_level, '-', 1) AS UNSIGNED) <= ?
          AND CAST(SUBSTRING_INDEX(er.grade_level, '-', -1) AS UNSIGNED) >= ?
        )
      )`;
      params.push(studentGrade.toString(), studentGrade, studentGrade);
    } else {
      // Si no hay grado, mostrar recursos para "Todos"
      gradeCondition = ` AND (er.grade_level = 'Todos' OR er.grade_level IS NULL)`;
    }
    
    let query = `
      SELECT 
        er.id,
        er.subject,
        er.area,
        er.topic,
        er.title,
        er.description,
        er.url,
        er.resource_type,
        er.grade_level,
        er.phase,
        er.difficulty,
        er.views_count,
        er.rating
      FROM educational_resources er
      WHERE er.is_active = TRUE
        ${gradeCondition}
    `;
    
    // Filtrar por materias de los docentes del estudiante si hay materias disponibles
    if (teacherSubjects.length > 0) {
      const subjectPlaceholders = teacherSubjects.map(() => '?').join(',');
      query += ` AND er.subject IN (${subjectPlaceholders})`;
      params.push(...teacherSubjects);
      console.log(`📌 Filtrando recursos por materias: ${teacherSubjects.join(', ')}`);
      console.log(`📊 Grado del estudiante: ${studentGrade || 'No especificado'}`);
    } else {
      console.log('⚠️ El estudiante no tiene docentes con materias asignadas - mostrando recursos generales');
      console.log(`📊 Grado del estudiante: ${studentGrade || 'No especificado'}`);
    }
    
    // Si hay fases con bajas calificaciones, priorizar recursos de esas fases
    if (phases.length > 0) {
      query += ` AND (er.phase IN (${phases.map(() => '?').join(',')}) OR er.phase IS NULL)`;
      params.push(...phases);
    }
    
    // Construir ORDER BY: si hay fases, priorizar recursos de esas fases
    if (phases.length > 0) {
      query += ` ORDER BY 
        CASE WHEN er.phase IN (${phases.map(() => '?').join(',')}) THEN 0 ELSE 1 END,
        er.views_count DESC,
        er.rating DESC
        LIMIT 10`;
      params.push(...phases);
    } else {
      // Si no hay fases, ordenar solo por views_count y rating
      query += ` ORDER BY 
        er.views_count DESC,
        er.rating DESC
        LIMIT 10`;
    }
    
    console.log(`🔍 Query SQL: ${query}`);
    console.log(`📋 Parámetros:`, params);
    
    const [resources] = await connection.query(query, params);
    
    console.log(`✅ Recursos encontrados: ${resources.length}`);
    if (resources.length > 0) {
      console.log(`📚 Primeros recursos:`, resources.slice(0, 3).map(r => ({ id: r.id, title: r.title, subject: r.subject, grade_level: r.grade_level })));
    } else {
      console.log(`⚠️ No se encontraron recursos. Verificando si hay recursos en la base de datos...`);
      // Consulta de depuración: verificar si hay recursos en la base de datos
      const [allResources] = await connection.query(
        `SELECT COUNT(*) as total FROM educational_resources WHERE is_active = TRUE`
      );
      console.log(`📊 Total de recursos activos en BD: ${allResources[0]?.total || 0}`);
      
      // Verificar recursos por materia
      if (teacherSubjects.length > 0) {
        const [resourcesBySubject] = await connection.query(
          `SELECT COUNT(*) as total FROM educational_resources 
           WHERE is_active = TRUE AND subject IN (${teacherSubjects.map(() => '?').join(',')})`,
          teacherSubjects
        );
        console.log(`📊 Recursos activos para materias ${teacherSubjects.join(', ')}: ${resourcesBySubject[0]?.total || 0}`);
      }
    }
    
    res.json({
      success: true,
      count: resources.length,
      data: resources,
      student: {
        grade: student.grade,
        course: student.course_name
      }
    });
    
  } catch (error) {
    console.error('❌ Error al obtener recursos recomendados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener recursos recomendados',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/educational-resources/student/:studentId/bookmarked
 * Obtener recursos marcados como favoritos por el estudiante
 */
router.get('/student/:studentId/bookmarked', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { studentId } = req.params;
    
    if (req.user.role === 'estudiante' && req.user.student_id !== parseInt(studentId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a estos recursos'
      });
    }
    
    const [resources] = await connection.query(
      `SELECT 
        er.id,
        er.subject,
        er.area,
        er.topic,
        er.title,
        er.description,
        er.url,
        er.resource_type,
        er.grade_level,
        er.phase,
        er.difficulty,
        er.views_count,
        er.rating,
        sru.viewed_at,
        sru.is_bookmarked
      FROM student_resource_usage sru
      JOIN educational_resources er ON sru.resource_id = er.id
      WHERE sru.student_id = ? AND sru.is_bookmarked = TRUE AND er.is_active = TRUE
      ORDER BY sru.viewed_at DESC`,
      [studentId]
    );
    
    res.json({
      success: true,
      count: resources.length,
      data: resources
    });
    
  } catch (error) {
    console.error('❌ Error al obtener recursos favoritos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener recursos favoritos',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/educational-resources/student/:studentId/bookmark/:resourceId
 * Marcar/desmarcar un recurso como favorito
 */
router.post('/student/:studentId/bookmark/:resourceId', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { studentId, resourceId } = req.params;
    const { is_bookmarked = true } = req.body;
    
    if (req.user.role === 'estudiante' && req.user.student_id !== parseInt(studentId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para realizar esta acción'
      });
    }
    
    // Verificar si ya existe un registro
    const [existing] = await connection.query(
      `SELECT id FROM student_resource_usage 
       WHERE student_id = ? AND resource_id = ?`,
      [studentId, resourceId]
    );
    
    if (existing.length > 0) {
      // Actualizar
      await connection.query(
        `UPDATE student_resource_usage 
         SET is_bookmarked = ?, viewed_at = CURRENT_TIMESTAMP
         WHERE student_id = ? AND resource_id = ?`,
        [is_bookmarked, studentId, resourceId]
      );
    } else {
      // Crear nuevo registro
      await connection.query(
        `INSERT INTO student_resource_usage 
         (student_id, resource_id, is_bookmarked, viewed_at) 
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [studentId, resourceId, is_bookmarked]
      );
    }
    
    res.json({
      success: true,
      message: is_bookmarked ? 'Recurso marcado como favorito' : 'Recurso desmarcado de favoritos'
    });
    
  } catch (error) {
    console.error('❌ Error al marcar recurso como favorito:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar recurso como favorito',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/educational-resources/student/:studentId/view/:resourceId
 * Registrar visualización de un recurso
 */
router.post('/student/:studentId/view/:resourceId', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { studentId, resourceId } = req.params;
    const { time_spent_minutes = 0 } = req.body;
    
    if (req.user.role === 'estudiante' && req.user.student_id !== parseInt(studentId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para realizar esta acción'
      });
    }
    
    // Verificar si ya existe un registro
    const [existing] = await connection.query(
      `SELECT id, time_spent_minutes FROM student_resource_usage 
       WHERE student_id = ? AND resource_id = ?`,
      [studentId, resourceId]
    );
    
    if (existing.length > 0) {
      // Actualizar
      const newTimeSpent = (existing[0].time_spent_minutes || 0) + (time_spent_minutes || 0);
      await connection.query(
        `UPDATE student_resource_usage 
         SET viewed_at = CURRENT_TIMESTAMP, time_spent_minutes = ?
         WHERE student_id = ? AND resource_id = ?`,
        [newTimeSpent, studentId, resourceId]
      );
    } else {
      // Crear nuevo registro
      await connection.query(
        `INSERT INTO student_resource_usage 
         (student_id, resource_id, viewed_at, time_spent_minutes) 
         VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
        [studentId, resourceId, time_spent_minutes || 0]
      );
    }
    
    res.json({
      success: true,
      message: 'Visualización registrada'
    });
    
  } catch (error) {
    console.error('❌ Error al registrar visualización:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar visualización',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// ==========================================
// RUTAS PARA DOCENTES, ADMINISTRADORES Y SUPER ADMINISTRADORES (CRUD completo)
// ==========================================

/**
 * POST /api/educational-resources
 * Crear un nuevo recurso educativo
 * Roles: docente, administrador, super_administrador
 */
router.post('/', verifyToken, isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const {
      subject,
      area,
      topic,
      title,
      description,
      url,
      resource_type,
      grade_level,
      phase,
      difficulty,
      institution_id
    } = req.body;
    
    // Validaciones
    if (!subject || !area || !title || !url) {
      return res.status(400).json({
        success: false,
        message: 'Los campos subject, area, title y url son obligatorios'
      });
    }
    
    // Validar URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'URL no válida'
      });
    }
    
    const [result] = await connection.query(
      `INSERT INTO educational_resources 
       (subject, area, topic, title, description, url, resource_type, 
        grade_level, phase, difficulty, institution_id, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subject,
        area,
        topic || null,
        title,
        description || null,
        url,
        resource_type || 'otro',
        grade_level || null,
        phase || null,
        difficulty || 'intermedio',
        institution_id || null,
        req.user.id
      ]
    );
    
    const [newResource] = await connection.query(
      `SELECT * FROM educational_resources WHERE id = ?`,
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Recurso educativo creado exitosamente',
      data: newResource[0]
    });
    
  } catch (error) {
    console.error('❌ Error al crear recurso educativo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear recurso educativo',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/educational-resources/all
 * Obtener todos los recursos (incluyendo inactivos) - Solo para administradores
 */
router.get('/all', verifyToken, isAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { 
      subject, 
      area, 
      grade_level, 
      phase, 
      difficulty, 
      resource_type,
      is_active,
      institution_id 
    } = req.query;
    
    let query = `
      SELECT 
        er.*,
        u.name as created_by_name
      FROM educational_resources er
      LEFT JOIN users u ON er.created_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (subject) {
      query += ` AND er.subject = ?`;
      params.push(subject);
    }
    
    if (area) {
      query += ` AND er.area = ?`;
      params.push(area);
    }
    
    if (grade_level) {
      query += ` AND er.grade_level = ?`;
      params.push(grade_level);
    }
    
    if (phase) {
      query += ` AND er.phase = ?`;
      params.push(phase);
    }
    
    if (difficulty) {
      query += ` AND er.difficulty = ?`;
      params.push(difficulty);
    }
    
    if (resource_type) {
      query += ` AND er.resource_type = ?`;
      params.push(resource_type);
    }
    
    if (is_active !== undefined) {
      query += ` AND er.is_active = ?`;
      params.push(is_active === 'true');
    }
    
    if (institution_id) {
      query += ` AND (er.institution_id = ? OR er.institution_id IS NULL)`;
      params.push(institution_id);
    }
    
    query += ` ORDER BY er.created_at DESC`;
    
    const [resources] = await connection.query(query, params);
    
    res.json({
      success: true,
      count: resources.length,
      data: resources
    });
    
  } catch (error) {
    console.error('❌ Error al obtener recursos educativos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener recursos educativos',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/educational-resources/:id
 * Obtener un recurso específico por ID
 */
router.get('/:id', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    
    const [resources] = await connection.query(
      `SELECT 
        er.*,
        u.name as created_by_name
      FROM educational_resources er
      LEFT JOIN users u ON er.created_by = u.id
      WHERE er.id = ?`,
      [id]
    );
    
    if (resources.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recurso educativo no encontrado'
      });
    }
    
    // Si el recurso está inactivo, solo administradores pueden verlo
    if (!resources[0].is_active && 
        req.user.role !== 'admin' && 
        req.user.role !== 'super_administrador') {
      return res.status(403).json({
        success: false,
        message: 'Este recurso no está disponible'
      });
    }
    
    res.json({
      success: true,
      data: resources[0]
    });
    
  } catch (error) {
    console.error('❌ Error al obtener recurso educativo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener recurso educativo',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/educational-resources/:id
 * Actualizar un recurso educativo
 * Roles: docente (solo sus recursos), administrador, super_administrador
 */
router.put('/:id', verifyToken, isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const {
      subject,
      area,
      topic,
      title,
      description,
      url,
      resource_type,
      grade_level,
      phase,
      difficulty,
      institution_id,
      is_active
    } = req.body;
    
    // Verificar que el recurso existe
    const [existing] = await connection.query(
      `SELECT * FROM educational_resources WHERE id = ?`,
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recurso educativo no encontrado'
      });
    }
    
    // Si es docente, solo puede editar sus propios recursos
    if (req.user.role === 'docente' && existing[0].created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar este recurso'
      });
    }
    
    // Validar URL si se proporciona
    if (url) {
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'URL no válida'
        });
      }
    }
    
    // Construir query de actualización
    const updates = [];
    const params = [];
    
    if (subject !== undefined) {
      updates.push('subject = ?');
      params.push(subject);
    }
    if (area !== undefined) {
      updates.push('area = ?');
      params.push(area);
    }
    if (topic !== undefined) {
      updates.push('topic = ?');
      params.push(topic);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (url !== undefined) {
      updates.push('url = ?');
      params.push(url);
    }
    if (resource_type !== undefined) {
      updates.push('resource_type = ?');
      params.push(resource_type);
    }
    if (grade_level !== undefined) {
      updates.push('grade_level = ?');
      params.push(grade_level);
    }
    if (phase !== undefined) {
      updates.push('phase = ?');
      params.push(phase === '' ? null : phase);
    }
    if (difficulty !== undefined) {
      updates.push('difficulty = ?');
      params.push(difficulty);
    }
    if (institution_id !== undefined) {
      updates.push('institution_id = ?');
      params.push(institution_id === '' ? null : institution_id);
    }
    if (is_active !== undefined && (req.user.role === 'admin' || req.user.role === 'super_administrador')) {
      updates.push('is_active = ?');
      params.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron campos para actualizar'
      });
    }
    
    params.push(id);
    
    await connection.query(
      `UPDATE educational_resources 
       SET ${updates.join(', ')} 
       WHERE id = ?`,
      params
    );
    
    const [updated] = await connection.query(
      `SELECT * FROM educational_resources WHERE id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'Recurso educativo actualizado exitosamente',
      data: updated[0]
    });
    
  } catch (error) {
    console.error('❌ Error al actualizar recurso educativo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar recurso educativo',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * DELETE /api/educational-resources/:id
 * Eliminar un recurso educativo (soft delete: is_active = false)
 * Roles: docente (solo sus recursos), administrador, super_administrador
 */
router.delete('/:id', verifyToken, isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { hard_delete = false } = req.query; // Solo super_admin puede hacer hard delete
    
    // Verificar que el recurso existe
    const [existing] = await connection.query(
      `SELECT * FROM educational_resources WHERE id = ?`,
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recurso educativo no encontrado'
      });
    }
    
    // Si es docente, solo puede eliminar sus propios recursos
    if (req.user.role === 'docente' && existing[0].created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este recurso'
      });
    }
    
    // Hard delete solo para super_administrador
    if (hard_delete === 'true' && req.user.role === 'super_administrador') {
      await connection.query(
        `DELETE FROM educational_resources WHERE id = ?`,
        [id]
      );
      
      return res.json({
        success: true,
        message: 'Recurso educativo eliminado permanentemente'
      });
    }
    
    // Soft delete (marcar como inactivo)
    await connection.query(
      `UPDATE educational_resources SET is_active = FALSE WHERE id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'Recurso educativo desactivado exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error al eliminar recurso educativo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar recurso educativo',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/educational-resources/stats/usage
 * Obtener estadísticas de uso de recursos
 * Roles: administrador, super_administrador
 */
router.get('/stats/usage', verifyToken, isAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const [stats] = await connection.query(
      `SELECT 
        er.id,
        er.title,
        er.subject,
        er.area,
        COUNT(sru.id) as total_views,
        SUM(sru.time_spent_minutes) as total_time_spent,
        AVG(sru.rating) as avg_rating,
        SUM(CASE WHEN sru.is_bookmarked THEN 1 ELSE 0 END) as bookmarks_count
      FROM educational_resources er
      LEFT JOIN student_resource_usage sru ON er.id = sru.resource_id
      WHERE er.is_active = TRUE
      GROUP BY er.id, er.title, er.subject, er.area
      ORDER BY total_views DESC
      LIMIT 50`
    );
    
    res.json({
      success: true,
      count: stats.length,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

export default router;
