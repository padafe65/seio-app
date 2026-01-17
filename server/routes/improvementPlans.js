// routes/improvementPlans.js
console.log('🔧 Cargando rutas de improvementPlans...');
import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';
import { processQuestionnaireResults, processStudentImprovementPlan } from '../utils/autoImprovementPlans.js';

const router = express.Router();

// Ruta de prueba sin autenticación
router.get('/test', (req, res) => {
  res.json({ message: 'Rutas de improvement plans funcionando correctamente' });
});

// Ruta de prueba para verificar la conexión a la base de datos
router.get('/test-db', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT COUNT(*) as total FROM improvement_plans');
    res.json({ 
      message: 'Conexión a la base de datos exitosa',
      total_plans: result[0].total,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error en test-db:', error);
    res.status(500).json({ 
      message: 'Error de conexión a la base de datos',
      error: error.message 
    });
  }
});

// Obtener todos los planes de mejoramiento (con filtros opcionales)
router.get('/improvement-plans', verifyToken, async (req, res) => {
  try {
    const { institution, course, grade, teacher_name, student_name, activity_status } = req.query;
    
    // Verificar si el campo institution existe en users
    let hasInstitution = false;
    try {
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    // Construir la consulta base usando DISTINCT para evitar duplicados
    let query = `
      SELECT DISTINCT ip.id, ip.student_id, ip.teacher_id, ip.title, ip.subject, 
             ip.description, ip.activities, ip.deadline, ip.file_url, 
             ip.failed_achievements, ip.passed_achievements, ip.completed, 
             ip.email_sent, ip.created_at, ip.video_urls, ip.resource_links,
             ip.activity_status, ip.completion_date, ip.teacher_notes, 
             ip.student_feedback, ip.attempts_count, ip.last_activity_date,
             s.user_id as student_user_id, 
             t.user_id as teacher_user_id,
             us.name as student_name,
             ut.name as teacher_name,
             c.name as course_name,
             s.grade,
             s.course_id
    `;
    
    // Agregar institution si existe el campo
    if (hasInstitution) {
      query += `, COALESCE(us.institution, ut.institution) as institution`;
    }
    
    query += `
      FROM improvement_plans ip
      JOIN students s ON ip.student_id = s.id
      JOIN teachers t ON ip.teacher_id = t.id
      JOIN users us ON s.user_id = us.id
      JOIN users ut ON t.user_id = ut.id
      LEFT JOIN courses c ON s.course_id = c.id
    `;
    
    const conditions = [];
    const params = [];
    
    // Agregar filtros si se proporcionan
    if (institution && hasInstitution) {
      conditions.push(`(us.institution LIKE ? OR ut.institution LIKE ?)`);
      const institutionPattern = `%${institution}%`;
      params.push(institutionPattern, institutionPattern);
    }
    
    if (course) {
      conditions.push(`c.name LIKE ?`);
      params.push(`%${course}%`);
    }
    
    if (grade) {
      conditions.push(`s.grade = ?`);
      params.push(parseInt(grade));
    }
    
    if (teacher_name) {
      conditions.push(`ut.name LIKE ?`);
      params.push(`%${teacher_name}%`);
    }
    
    if (student_name) {
      conditions.push(`us.name LIKE ?`);
      params.push(`%${student_name}%`);
    }
    
    if (activity_status) {
      conditions.push(`ip.activity_status = ?`);
      params.push(activity_status);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY ip.created_at DESC`;
    
    const [plans] = await pool.query(query, params);
    res.json(plans);
  } catch (error) {
    console.error('Error al obtener planes de mejoramiento:', error);
    res.status(500).json({ message: 'Error al obtener planes de mejoramiento' });
  }
});

// Obtener planes de mejoramiento por estudiante (usando user_id)
router.get('/improvement-plans/student/:userId', async (req, res) => {
  try {
    // Primero obtenemos el student_id asociado con este user_id
    const [students] = await pool.query(
      'SELECT id FROM students WHERE user_id = ?',
      [req.params.userId]
    );
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    const studentId = students[0].id;
    
    // Ahora obtenemos los planes de mejoramiento
    const [plans] = await pool.query(`
      SELECT ip.*, 
             t.user_id as teacher_user_id,
             ut.name as teacher_name,
             s.grade,
             c.name as course_name
      FROM improvement_plans ip
      JOIN students s ON ip.student_id = s.id
      JOIN teachers t ON ip.teacher_id = t.id
      JOIN users ut ON t.user_id = ut.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE ip.student_id = ?
      ORDER BY ip.created_at DESC
    `, [studentId]);
    
    res.json(plans);
  } catch (error) {
    console.error('Error al obtener planes de mejoramiento del estudiante:', error);
    res.status(500).json({ message: 'Error al obtener planes de mejoramiento del estudiante' });
  }
});

// Obtener planes de mejoramiento por profesor (usando user_id)
router.get('/improvement-plans/teacher/:userId', verifyToken, async (req, res) => {
  try {
    // Primero obtenemos el teacher_id asociado con este user_id
    const [teachers] = await pool.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [req.params.userId]
    );
    
    if (teachers.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    const teacherId = teachers[0].id;
    
    // Ahora obtenemos los planes de mejoramiento
    const [plans] = await pool.query(`
      SELECT ip.*, 
             s.user_id as student_user_id,
             us.name as student_name,
             s.grade,
             c.name as course_name
      FROM improvement_plans ip
      JOIN students s ON ip.student_id = s.id
      JOIN users us ON s.user_id = us.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE ip.teacher_id = ?
      ORDER BY ip.created_at DESC
    `, [teacherId]);
    
    res.json(plans);
  } catch (error) {
    console.error('Error al obtener planes de mejoramiento del profesor:', error);
    res.status(500).json({ message: 'Error al obtener planes de mejoramiento del profesor' });
  }
});

// Obtener plantillas de descripción para planes de mejoramiento
router.get('/improvement-plans/templates', verifyToken, async (req, res) => {
  try {
    console.log('🔍 Obteniendo plantillas de planes de mejoramiento...');
    
    const [templates] = await pool.query(`
      SELECT DISTINCT 
        title,
        description,
        subject,
        activities,
        failed_achievements,
        passed_achievements,
        teacher_notes
      FROM improvement_plans 
      WHERE description IS NOT NULL AND description != ''
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    console.log(`✅ Se encontraron ${templates.length} plantillas`);
    
    // Si no hay plantillas, devolver array vacío
    if (!templates || templates.length === 0) {
      console.log('📝 No hay plantillas disponibles, devolviendo array vacío');
      return res.json([]);
    }
    
    // Formatear las plantillas para el frontend
    const formattedTemplates = templates.map(template => ({
      title: template.title || 'Plan de Mejoramiento',
      description: template.description,
      subject: template.subject,
      activities: template.activities,
      failed_achievements: template.failed_achievements,
      passed_achievements: template.passed_achievements,
      teacher_notes: template.teacher_notes
    }));
    
    res.json(formattedTemplates);
  } catch (error) {
    console.error('❌ Error al obtener plantillas de descripción:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener plantillas de descripción',
      error: error.message 
    });
  }
});

// =====================================================
// RUTAS ESPECÍFICAS DEBEN IR ANTES DE RUTAS CON PARÁMETROS
// =====================================================

// Obtener estadísticas de planes automáticos
router.get('/improvement-plans/auto-stats', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas de planes automáticos');
    
    // Estadísticas generales
    const [totalStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN activity_status = 'pending' THEN 1 END) as pending_plans,
        COUNT(CASE WHEN activity_status = 'in_progress' THEN 1 END) as in_progress_plans,
        COUNT(CASE WHEN activity_status = 'completed' THEN 1 END) as completed_plans,
        COUNT(CASE WHEN activity_status = 'failed' THEN 1 END) as failed_plans,
        COUNT(CASE WHEN teacher_notes LIKE '%generado automáticamente%' THEN 1 END) as auto_generated_plans
      FROM improvement_plans
    `);
    
    // Estadísticas por materia
    const [subjectStats] = await pool.query(`
      SELECT 
        subject,
        COUNT(*) as total_plans,
        COUNT(CASE WHEN activity_status = 'completed' THEN 1 END) as completed_plans,
        AVG(CASE WHEN activity_status = 'completed' THEN 1 ELSE 0 END) * 100 as completion_rate
      FROM improvement_plans
      WHERE teacher_notes LIKE '%generado automáticamente%'
      GROUP BY subject
      ORDER BY total_plans DESC
    `);
    
    // Estadísticas por grado
    const [gradeStats] = await pool.query(`
      SELECT 
        s.grade,
        COUNT(*) as total_plans,
        COUNT(CASE WHEN ip.activity_status = 'completed' THEN 1 END) as completed_plans,
        AVG(CASE WHEN ip.activity_status = 'completed' THEN 1 ELSE 0 END) * 100 as completion_rate
      FROM improvement_plans ip
      JOIN students s ON ip.student_id = s.id
      WHERE ip.teacher_notes LIKE '%generado automáticamente%'
      GROUP BY s.grade
      ORDER BY s.grade
    `);
    
    // Planes recientes
    const [recentPlans] = await pool.query(`
      SELECT 
        ip.id,
        ip.title,
        ip.subject,
        ip.activity_status,
        ip.created_at,
        us.name as student_name,
        s.grade,
        ut.name as teacher_name
      FROM improvement_plans ip
      JOIN students s ON ip.student_id = s.id
      JOIN users us ON s.user_id = us.id
      JOIN teachers t ON ip.teacher_id = t.id
      JOIN users ut ON t.user_id = ut.id
      WHERE ip.teacher_notes LIKE '%generado automáticamente%'
      ORDER BY ip.created_at DESC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      message: 'Estadísticas obtenidas correctamente',
      data: {
        general: totalStats[0],
        by_subject: subjectStats,
        by_grade: gradeStats,
        recent_plans: recentPlans
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
});

// Obtener vista de planes automáticos
router.get('/improvement-plans/auto-view', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    console.log('👁️ Obteniendo vista de planes automáticos');
    
    const [autoPlans] = await pool.query(`
      SELECT 
        ip.id as plan_id,
        ip.title,
        ip.subject,
        ip.activity_status,
        ip.created_at,
        ip.deadline,
        us.name as student_name,
        s.grade,
        s.contact_email,
        ut.name as teacher_name,
        q.title as questionnaire_title,
        q.id as questionnaire_id,
        er.best_score as student_score,
        CASE 
          WHEN ip.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 'RECIENTE'
          WHEN ip.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'ACTIVO'
          ELSE 'ANTIGUO'
        END as plan_age,
        DATEDIFF(ip.deadline, NOW()) as days_remaining
      FROM improvement_plans ip
      JOIN students s ON ip.student_id = s.id
      JOIN users us ON s.user_id = us.id
      JOIN teachers t ON ip.teacher_id = t.id
      JOIN users ut ON t.user_id = ut.id
      LEFT JOIN questionnaires q ON ip.title LIKE CONCAT('%', q.title, '%')
      LEFT JOIN evaluation_results er ON er.student_id = s.id AND er.questionnaire_id = q.id
      WHERE ip.teacher_notes LIKE '%generado automáticamente%'
      ORDER BY ip.created_at DESC
    `);
    
    res.json({
      success: true,
      message: 'Vista de planes automáticos obtenida',
      data: autoPlans
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo vista de planes automáticos:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo vista de planes automáticos',
      error: error.message
    });
  }
});

// Ejecutar procedimiento almacenado para procesar cuestionario
router.post('/improvement-plans/execute-procedure/:questionnaireId', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    
    console.log(`⚙️ Ejecutando procedimiento almacenado para cuestionario ${questionnaireId}`);
    
    // Verificar si el procedimiento existe antes de ejecutarlo
    try {
      const [result] = await pool.query('CALL sp_process_questionnaire_improvement_plans(?)', [questionnaireId]);
      
      res.json({
        success: true,
        message: 'Procedimiento ejecutado correctamente',
        data: result[0] || result
      });
    } catch (procedureError) {
      // Si el procedimiento no existe, usar la función alternativa
      if (procedureError.code === 'ER_SP_DOES_NOT_EXIST' || procedureError.message.includes('does not exist') || procedureError.message.includes('no existe')) {
        console.log('⚠️ Procedimiento almacenado no existe, usando función alternativa...');
        
        // Usar la función processQuestionnaireResults como alternativa
        const result = await processQuestionnaireResults(parseInt(questionnaireId));
        
        res.json({
          success: true,
          message: 'Procesamiento completado usando método alternativo',
          data: result
        });
      } else {
        throw procedureError;
      }
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando procedimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando procedimiento almacenado',
      error: error.message,
      code: error.code
    });
  }
});

// Obtener un plan de mejoramiento específico
router.get('/improvement-plans/:id', async (req, res) => {
  try {
    const [plans] = await pool.query(`
      SELECT ip.*, 
             s.user_id as student_user_id, 
             t.user_id as teacher_user_id,
             us.name as student_name,
             ut.name as teacher_name,
             s.grade,
             s.contact_email,
             c.name as course_name
      FROM improvement_plans ip
      JOIN students s ON ip.student_id = s.id
      JOIN teachers t ON ip.teacher_id = t.id
      JOIN users us ON s.user_id = us.id
      JOIN users ut ON t.user_id = ut.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE ip.id = ?
    `, [req.params.id]);
    
    if (plans.length === 0) {
      return res.status(404).json({ message: 'Plan de mejoramiento no encontrado' });
    }
    
    res.json(plans[0]);
  } catch (error) {
    console.error('Error al obtener plan de mejoramiento:', error);
    res.status(500).json({ message: 'Error al obtener plan de mejoramiento' });
  }
});

// Crear un nuevo plan de mejoramiento
router.post('/improvement-plans', async (req, res) => {
  try {
    const { 
      student_id, 
      teacher_id, 
      title, 
      subject, 
      description, 
      activities, 
      deadline, 
      file_url, 
      failed_achievements, 
      passed_achievements,
      video_urls,
      resource_links,
      activity_status,
      teacher_notes,
      student_feedback,
      attempts_count,
      last_activity_date
    } = req.body;
    
    // Verificar que student_id existe
    const [studentCheck] = await pool.query('SELECT * FROM students WHERE id = ?', [student_id]);
    if (studentCheck.length === 0) {
      return res.status(400).json({ message: 'El estudiante no existe' });
    }
    
    // Verificar que teacher_id existe
    const [teacherCheck] = await pool.query('SELECT * FROM teachers WHERE id = ?', [teacher_id]);
    if (teacherCheck.length === 0) {
      return res.status(400).json({ message: 'El profesor no existe' });
    }
    
    // Verificar si ya existe un plan similar para este estudiante
    // Un plan se considera duplicado si tiene el mismo student_id, teacher_id, title y subject
    // y no está completado (o está pendiente/en progreso)
    const [existingPlans] = await pool.query(
      `SELECT id, title, subject, activity_status, completed, created_at 
       FROM improvement_plans 
       WHERE student_id = ? 
       AND teacher_id = ? 
       AND title = ? 
       AND subject = ?
       AND (completed = 0 OR activity_status IN ('pending', 'in_progress'))`,
      [student_id, teacher_id, title.trim(), subject]
    );
    
    if (existingPlans.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Ya existe un plan de mejoramiento activo con el mismo título y materia para este estudiante',
        duplicate_plan_id: existingPlans[0].id,
        duplicate_plan: {
          id: existingPlans[0].id,
          title: existingPlans[0].title,
          subject: existingPlans[0].subject,
          status: existingPlans[0].activity_status || (existingPlans[0].completed ? 'completed' : 'pending'),
          created_at: existingPlans[0].created_at
        }
      });
    }
    
    // Obtener el email del estudiante para notificación
    const [studentData] = await pool.query(
      'SELECT contact_email FROM students WHERE id = ?',
      [student_id]
    );
    const studentEmail = studentData[0]?.contact_email;
    
    // Insertar el plan de mejoramiento
    const [result] = await pool.query(
      `INSERT INTO improvement_plans 
       (student_id, teacher_id, title, subject, description, activities, deadline, 
        file_url, failed_achievements, passed_achievements, video_urls, resource_links,
        activity_status, teacher_notes, student_feedback, attempts_count, last_activity_date,
        completed, email_sent, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, false, NOW())`,
      [student_id, teacher_id, title, subject, description, activities, deadline, 
       file_url, failed_achievements, passed_achievements, video_urls, resource_links,
       activity_status || 'pending', teacher_notes, student_feedback, attempts_count || 0, last_activity_date]
    );
    
    // Si hay email, enviar notificación (implementar después)
    // TODO: Implementar envío de email
    
    res.status(201).json({ 
      message: 'Plan de mejoramiento creado correctamente',
      id: result.insertId,
      studentEmail
    });
  } catch (error) {
    console.error('Error al crear plan de mejoramiento:', error);
    res.status(500).json({ message: 'Error al crear plan de mejoramiento' });
  }
});

// Actualizar un plan de mejoramiento
router.put('/improvement-plans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      subject, 
      description, 
      activities, 
      deadline, 
      file_url, 
      failed_achievements, 
      passed_achievements,
      video_urls,
      resource_links,
      activity_status,
      completion_date,
      teacher_notes,
      student_feedback,
      attempts_count,
      last_activity_date,
      completed,
      email_sent
    } = req.body;
    
    // Verificar que el plan existe
    const [planCheck] = await pool.query('SELECT * FROM improvement_plans WHERE id = ?', [id]);
    if (planCheck.length === 0) {
      return res.status(404).json({ message: 'Plan de mejoramiento no encontrado' });
    }
    
    // Actualizar el plan
    await pool.query(
      `UPDATE improvement_plans 
       SET title = ?, subject = ?, description = ?, activities = ?, deadline = ?, 
           file_url = ?, failed_achievements = ?, passed_achievements = ?, 
           video_urls = ?, resource_links = ?, activity_status = ?, completion_date = ?,
           teacher_notes = ?, student_feedback = ?, attempts_count = ?, last_activity_date = ?,
           completed = ?, email_sent = ?
       WHERE id = ?`,
      [title, subject, description, activities, deadline, file_url, 
       failed_achievements, passed_achievements, video_urls, resource_links,
       activity_status, completion_date, teacher_notes, student_feedback, 
       attempts_count, last_activity_date, completed, email_sent, id]
    );
    
    res.json({ message: 'Plan de mejoramiento actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar plan de mejoramiento:', error);
    res.status(500).json({ message: 'Error al actualizar plan de mejoramiento' });
  }
});

// Eliminar un plan de mejoramiento
router.delete('/improvement-plans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el plan existe
    const [planCheck] = await pool.query('SELECT * FROM improvement_plans WHERE id = ?', [id]);
    if (planCheck.length === 0) {
      return res.status(404).json({ message: 'Plan de mejoramiento no encontrado' });
    }
    
    // Eliminar el plan
    await pool.query('DELETE FROM improvement_plans WHERE id = ?', [id]);
    
    res.json({ message: 'Plan de mejoramiento eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar plan de mejoramiento:', error);
    res.status(500).json({ message: 'Error al eliminar plan de mejoramiento' });
  }
});

// Obtener indicadores no alcanzados por estudiante, grado y fase
router.get('/improvement-plans/indicators/failed/:studentId/:grade/:phase', async (req, res) => {
  try {
    const { studentId, grade, phase } = req.params;
    console.log(`🔍 Buscando indicadores no alcanzados para estudiante ${studentId}, grado ${grade}, fase ${phase}`);
    
    // Obtener indicadores no alcanzados para este estudiante en esta fase
    const [indicators] = await pool.query(`
      SELECT i.id, i.description, i.subject, i.phase, i.grade, i.achieved
      FROM indicators i
      JOIN teacher_students ts ON i.teacher_id = ts.teacher_id
      WHERE ts.student_id = ? AND i.grade = ? AND i.phase = ? AND i.achieved = false
      ORDER BY i.subject
    `, [studentId, grade, phase]);
    
    console.log(`✅ Se encontraron ${indicators.length} indicadores no alcanzados`);
    
    // Si no hay indicadores, devolver array vacío
    if (!indicators || indicators.length === 0) {
      console.log('📝 No hay indicadores no alcanzados disponibles, devolviendo array vacío');
      return res.json([]);
    }
    
    res.json(indicators);
  } catch (error) {
    console.error('Error al obtener indicadores no alcanzados:', error);
    res.status(500).json({ message: 'Error al obtener indicadores no alcanzados' });
  }
});

// Obtener indicadores alcanzados por estudiante, grado y fase
router.get('/improvement-plans/indicators/passed/:studentId/:grade/:phase', async (req, res) => {
  try {
    const { studentId, grade, phase } = req.params;
    
    // Obtener indicadores alcanzados para este estudiante en esta fase
    const [indicators] = await pool.query(`
      SELECT i.id, i.description, i.subject, i.phase, i.grade, i.achieved
      FROM indicators i
      JOIN teacher_students ts ON i.teacher_id = ts.teacher_id
      WHERE ts.student_id = ? AND i.grade = ? AND i.phase = ? AND i.achieved = true
      ORDER BY i.subject
    `, [studentId, grade, phase]);
    
    res.json(indicators);
  } catch (error) {
    console.error('Error al obtener indicadores alcanzados:', error);
    res.status(500).json({ message: 'Error al obtener indicadores alcanzados' });
  }
});


// Añadir esta nueva ruta para obtener planes por student_id directamente
router.get('/improvement-plans/student-id/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Obtener planes de mejoramiento usando directamente el student_id
    const [plans] = await pool.query(`
      SELECT ip.*, 
             t.user_id as teacher_user_id,
             ut.name as teacher_name,
             s.grade,
             c.name as course_name
      FROM improvement_plans ip
      JOIN students s ON ip.student_id = s.id
      JOIN teachers t ON ip.teacher_id = t.id
      JOIN users ut ON t.user_id = ut.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE ip.student_id = ?
      ORDER BY ip.created_at DESC
    `, [studentId]);
    
    res.json(plans);
  } catch (error) {
    console.error('Error al obtener planes de mejoramiento del estudiante:', error);
    res.status(500).json({ message: 'Error al obtener planes de mejoramiento del estudiante' });
  }
});


// ===== RUTAS PARA RECURSOS DE RECUPERACIÓN =====

// Obtener recursos de un plan de mejoramiento
router.get('/improvement-plans/:id/resources', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [resources] = await pool.query(`
      SELECT * FROM recovery_resources 
      WHERE improvement_plan_id = ? 
      ORDER BY order_index ASC, created_at ASC
    `, [id]);
    
    res.json(resources);
  } catch (error) {
    console.error('Error al obtener recursos:', error);
    res.status(500).json({ message: 'Error al obtener recursos' });
  }
});

// Crear un nuevo recurso
router.post('/improvement-plans/:id/resources', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      resource_type, 
      title, 
      description, 
      url, 
      file_path, 
      thumbnail_url,
      duration_minutes,
      difficulty_level,
      order_index,
      is_required
    } = req.body;
    
    // Verificar que el plan existe
    const [planCheck] = await pool.query('SELECT * FROM improvement_plans WHERE id = ?', [id]);
    if (planCheck.length === 0) {
      return res.status(404).json({ message: 'Plan de mejoramiento no encontrado' });
    }
    
    const [result] = await pool.query(`
      INSERT INTO recovery_resources 
      (improvement_plan_id, resource_type, title, description, url, file_path, 
       thumbnail_url, duration_minutes, difficulty_level, order_index, is_required)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, resource_type, title, description, url, file_path, thumbnail_url, 
        duration_minutes, difficulty_level || 'basic', order_index || 0, is_required !== false]);
    
    res.status(201).json({ 
      message: 'Recurso creado correctamente',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error al crear recurso:', error);
    res.status(500).json({ message: 'Error al crear recurso' });
  }
});

// Actualizar un recurso
router.put('/resources/:resourceId', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { 
      resource_type, 
      title, 
      description, 
      url, 
      file_path, 
      thumbnail_url,
      duration_minutes,
      difficulty_level,
      order_index,
      is_required
    } = req.body;
    
    await pool.query(`
      UPDATE recovery_resources 
      SET resource_type = ?, title = ?, description = ?, url = ?, file_path = ?,
          thumbnail_url = ?, duration_minutes = ?, difficulty_level = ?, 
          order_index = ?, is_required = ?
      WHERE id = ?
    `, [resource_type, title, description, url, file_path, thumbnail_url,
        duration_minutes, difficulty_level, order_index, is_required, resourceId]);
    
    res.json({ message: 'Recurso actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar recurso:', error);
    res.status(500).json({ message: 'Error al actualizar recurso' });
  }
});

// Eliminar un recurso
router.delete('/resources/:resourceId', async (req, res) => {
  try {
    const { resourceId } = req.params;
    
    await pool.query('DELETE FROM recovery_resources WHERE id = ?', [resourceId]);
    
    res.json({ message: 'Recurso eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar recurso:', error);
    res.status(500).json({ message: 'Error al eliminar recurso' });
  }
});

// Marcar recurso como visto
router.post('/resources/:resourceId/viewed', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { student_id, completion_percentage } = req.body;
    
    await pool.query(`
      UPDATE recovery_resources 
      SET viewed = 1, viewed_at = NOW(), completion_percentage = ?
      WHERE id = ?
    `, [completion_percentage || 100, resourceId]);
    
    // Registrar en el progreso
    await pool.query(`
      INSERT INTO recovery_progress 
      (improvement_plan_id, student_id, resource_id, progress_type, progress_data, score)
      VALUES (
        (SELECT improvement_plan_id FROM recovery_resources WHERE id = ?),
        ?, ?, 'resource_viewed', 
        JSON_OBJECT('completion_percentage', ?),
        ?
      )
    `, [resourceId, student_id, resourceId, completion_percentage || 100, completion_percentage || 100]);
    
    res.json({ message: 'Recurso marcado como visto' });
  } catch (error) {
    console.error('Error al marcar recurso como visto:', error);
    res.status(500).json({ message: 'Error al marcar recurso como visto' });
  }
});

// ===== RUTAS PARA ACTIVIDADES DE RECUPERACIÓN =====

// Obtener actividades de un plan de mejoramiento
router.get('/improvement-plans/:id/activities', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [activities] = await pool.query(`
      SELECT ra.*, 
             i.description as indicator_description,
             q.title as questionnaire_title
      FROM recovery_activities ra
      LEFT JOIN indicators i ON ra.indicator_id = i.id
      LEFT JOIN questionnaires q ON ra.questionnaire_id = q.id
      WHERE ra.improvement_plan_id = ? 
      ORDER BY ra.due_date ASC, ra.created_at ASC
    `, [id]);
    
    res.json(activities);
  } catch (error) {
    console.error('Error al obtener actividades:', error);
    res.status(500).json({ message: 'Error al obtener actividades' });
  }
});

// Crear una nueva actividad
router.post('/improvement-plans/:id/activities', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      indicator_id,
      questionnaire_id,
      activity_type, 
      title, 
      description, 
      instructions, 
      due_date, 
      max_attempts,
      passing_score,
      weight
    } = req.body;
    
    // Verificar que el plan existe
    const [planCheck] = await pool.query('SELECT * FROM improvement_plans WHERE id = ?', [id]);
    if (planCheck.length === 0) {
      return res.status(404).json({ message: 'Plan de mejoramiento no encontrado' });
    }
    
    const [result] = await pool.query(`
      INSERT INTO recovery_activities 
      (improvement_plan_id, indicator_id, questionnaire_id, activity_type, title, 
       description, instructions, due_date, max_attempts, passing_score, weight)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, indicator_id, questionnaire_id, activity_type, title, description, 
        instructions, due_date, max_attempts || 3, passing_score || 3.5, weight || 1.00]);
    
    res.status(201).json({ 
      message: 'Actividad creada correctamente',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error al crear actividad:', error);
    res.status(500).json({ message: 'Error al crear actividad' });
  }
});

// Actualizar una actividad
router.put('/activities/:activityId', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { 
      indicator_id,
      questionnaire_id,
      activity_type, 
      title, 
      description, 
      instructions, 
      due_date, 
      max_attempts,
      passing_score,
      weight,
      status,
      student_score,
      attempts_count,
      completed_at,
      teacher_feedback,
      student_notes
    } = req.body;
    
    await pool.query(`
      UPDATE recovery_activities 
      SET indicator_id = ?, questionnaire_id = ?, activity_type = ?, title = ?, 
          description = ?, instructions = ?, due_date = ?, max_attempts = ?, 
          passing_score = ?, weight = ?, status = ?, student_score = ?, 
          attempts_count = ?, completed_at = ?, teacher_feedback = ?, student_notes = ?
      WHERE id = ?
    `, [indicator_id, questionnaire_id, activity_type, title, description, 
        instructions, due_date, max_attempts, passing_score, weight, status,
        student_score, attempts_count, completed_at, teacher_feedback, 
        student_notes, activityId]);
    
    res.json({ message: 'Actividad actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar actividad:', error);
    res.status(500).json({ message: 'Error al actualizar actividad' });
  }
});

// Eliminar una actividad
router.delete('/activities/:activityId', async (req, res) => {
  try {
    const { activityId } = req.params;
    
    await pool.query('DELETE FROM recovery_activities WHERE id = ?', [activityId]);
    
    res.json({ message: 'Actividad eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar actividad:', error);
    res.status(500).json({ message: 'Error al eliminar actividad' });
  }
});

// Completar una actividad
router.post('/activities/:activityId/complete', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { student_id, score, student_notes } = req.body;
    
    // Obtener información de la actividad
    const [activity] = await pool.query(`
      SELECT ra.*, ip.student_id as plan_student_id
      FROM recovery_activities ra
      JOIN improvement_plans ip ON ra.improvement_plan_id = ip.id
      WHERE ra.id = ?
    `, [activityId]);
    
    if (activity.length === 0) {
      return res.status(404).json({ message: 'Actividad no encontrada' });
    }
    
    const activityData = activity[0];
    
    // Verificar que el estudiante es el correcto
    if (activityData.plan_student_id != student_id) {
      return res.status(403).json({ message: 'No tienes permisos para completar esta actividad' });
    }
    
    // Determinar el estado basado en la puntuación
    const passingScore = activityData.passing_score || 3.5;
    const newStatus = score >= passingScore ? 'completed' : 'failed';
    
    // Actualizar la actividad
    await pool.query(`
      UPDATE recovery_activities 
      SET status = ?, student_score = ?, attempts_count = attempts_count + 1,
          completed_at = NOW(), student_notes = ?
      WHERE id = ?
    `, [newStatus, score, student_notes, activityId]);
    
    // Registrar en el progreso
    await pool.query(`
      INSERT INTO recovery_progress 
      (improvement_plan_id, student_id, activity_id, progress_type, progress_data, score)
      VALUES (?, ?, ?, 'activity_completed', 
              JSON_OBJECT('attempts_count', ?, 'passing_score', ?, 'status', ?),
              ?)
    `, [activityData.improvement_plan_id, student_id, activityId, 
        activityData.attempts_count + 1, passingScore, newStatus, score]);
    
    res.json({ 
      message: 'Actividad completada',
      status: newStatus,
      passed: score >= passingScore
    });
  } catch (error) {
    console.error('Error al completar actividad:', error);
    res.status(500).json({ message: 'Error al completar actividad' });
  }
});

// ===== RUTAS PARA SEGUIMIENTO DE PROGRESO =====

// Obtener progreso de un estudiante en un plan
router.get('/improvement-plans/:id/progress/:studentId', async (req, res) => {
  try {
    const { id, studentId } = req.params;
    
    const [progress] = await pool.query(`
      SELECT rp.*, 
             rr.title as resource_title,
             rr.resource_type,
             ra.title as activity_title,
             ra.activity_type
      FROM recovery_progress rp
      LEFT JOIN recovery_resources rr ON rp.resource_id = rr.id
      LEFT JOIN recovery_activities ra ON rp.activity_id = ra.id
      WHERE rp.improvement_plan_id = ? AND rp.student_id = ?
      ORDER BY rp.created_at DESC
    `, [id, studentId]);
    
    // Calcular estadísticas
    const [stats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT rr.id) as total_resources,
        COUNT(DISTINCT CASE WHEN rr.viewed = 1 THEN rr.id END) as viewed_resources,
        COUNT(DISTINCT ra.id) as total_activities,
        COUNT(DISTINCT CASE WHEN ra.status = 'completed' THEN ra.id END) as completed_activities,
        AVG(ra.student_score) as average_score
      FROM improvement_plans ip
      LEFT JOIN recovery_resources rr ON ip.id = rr.improvement_plan_id
      LEFT JOIN recovery_activities ra ON ip.id = ra.improvement_plan_id
      WHERE ip.id = ?
    `, [id]);
    
    res.json({
      progress,
      statistics: stats[0]
    });
  } catch (error) {
    console.error('Error al obtener progreso:', error);
    res.status(500).json({ message: 'Error al obtener progreso' });
  }
});

// Procesar planes de mejoramiento automáticamente para un estudiante específico
router.post('/improvement-plans/process-student/:studentId/:questionnaireId', verifyToken, async (req, res) => {
  try {
    const { studentId, questionnaireId } = req.params;
    
    console.log(`🔄 Procesando planes automáticos para estudiante ${studentId}, cuestionario ${questionnaireId}`);
    
    const result = await processAutomaticImprovementPlans(parseInt(studentId), parseInt(questionnaireId));
    
    res.json({
      success: true,
      message: 'Planes de mejoramiento procesados automáticamente',
      data: result
    });
  } catch (error) {
    console.error('❌ Error procesando planes automáticos:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando planes automáticos',
      error: error.message
    });
  }
});

// Procesar todos los estudiantes de un cuestionario
router.post('/improvement-plans/process-questionnaire/:questionnaireId', verifyToken, async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    
    console.log(`🔄 Procesando todos los estudiantes del cuestionario ${questionnaireId}`);
    
    const result = await processQuestionnaireResults(parseInt(questionnaireId));
    
    res.json({
      success: true,
      message: 'Cuestionario procesado automáticamente',
      data: result
    });
  } catch (error) {
    console.error('❌ Error procesando cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando cuestionario',
      error: error.message
    });
  }
});

// Obtener indicadores automáticamente basados en resultados de evaluación
router.get('/improvement-plans/auto-indicators/:studentId/:questionnaireId', verifyToken, async (req, res) => {
  try {
    const { studentId, questionnaireId } = req.params;
    
    console.log(`🔍 Obteniendo indicadores automáticos para estudiante ${studentId}, cuestionario ${questionnaireId}`);
    
    // Obtener resultado de evaluación
    const [evaluationResults] = await pool.query(`
      SELECT er.*, q.title as questionnaire_title, q.subject, q.grade
      FROM evaluation_results er
      JOIN questionnaires q ON er.questionnaire_id = q.id
      WHERE er.student_id = ? AND er.questionnaire_id = ?
      ORDER BY er.recorded_at DESC
      LIMIT 1
    `, [studentId, questionnaireId]);

    if (!evaluationResults || evaluationResults.length === 0) {
      return res.json({
        success: false,
        message: 'No se encontraron resultados de evaluación',
        data: { failedIndicators: [], passedIndicators: [] }
      });
    }

    const evaluation = evaluationResults[0];
    const minimumScore = 3.5;
    const needsImprovement = evaluation.best_score < minimumScore;

    // Obtener indicadores del cuestionario
    const [indicators] = await pool.query(`
      SELECT qi.*, i.description, i.subject, i.grade, i.phase
      FROM questionnaire_indicators qi
      JOIN indicators i ON qi.indicator_id = i.id
      WHERE qi.questionnaire_id = ?
    `, [questionnaireId]);

    // Separar indicadores
    const failedIndicators = needsImprovement ? indicators : [];
    const passedIndicators = !needsImprovement ? indicators : [];

    res.json({
      success: true,
      message: 'Indicadores obtenidos automáticamente',
      data: {
        evaluation: evaluation,
        needsImprovement: needsImprovement,
        failedIndicators: failedIndicators,
        passedIndicators: passedIndicators
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo indicadores automáticos:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo indicadores automáticos',
      error: error.message
    });
  }
});

// =====================================================
// RUTAS DEL SISTEMA AUTOMÁTICO DE PLANES DE MEJORAMIENTO
// =====================================================

// Procesar automáticamente todos los resultados de un cuestionario
router.post('/improvement-plans/process-questionnaire/:questionnaireId', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    
    console.log(`🔄 Procesando automáticamente cuestionario ${questionnaireId}`);
    
    const result = await processQuestionnaireResults(parseInt(questionnaireId));
    
    res.json({
      success: true,
      message: 'Procesamiento automático completado',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error procesando cuestionario automáticamente:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando cuestionario automáticamente',
      error: error.message
    });
  }
});

// Procesar automáticamente un estudiante específico para un cuestionario
router.post('/improvement-plans/process-student/:studentId/:questionnaireId', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { studentId, questionnaireId } = req.params;
    
    console.log(`🔄 Procesando automáticamente estudiante ${studentId} para cuestionario ${questionnaireId}`);
    
    const result = await processStudentImprovementPlan(parseInt(studentId), parseInt(questionnaireId));
    
    res.json({
      success: true,
      message: 'Procesamiento automático del estudiante completado',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error procesando estudiante automáticamente:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando estudiante automáticamente',
      error: error.message
    });
  }
});

export default router;
