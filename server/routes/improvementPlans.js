// routes/improvementPlans.js
import express from 'express';
import db from '../config/db.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Ruta de prueba sin autenticación
router.get('/test', (req, res) => {
  res.json({ message: 'Rutas de improvement plans funcionando correctamente' });
});

// Obtener todos los planes de mejoramiento
router.get('/improvement-plans', verifyToken, async (req, res) => {
  try {
    const [plans] = await db.query(`
      SELECT ip.*, 
             s.user_id as student_user_id, 
             t.user_id as teacher_user_id,
             us.name as student_name,
             ut.name as teacher_name,
             c.name as course_name
      FROM improvement_plans ip
      JOIN students s ON ip.student_id = s.id
      JOIN teachers t ON ip.teacher_id = t.id
      JOIN users us ON s.user_id = us.id
      JOIN users ut ON t.user_id = ut.id
      LEFT JOIN courses c ON s.course_id = c.id
      ORDER BY ip.created_at DESC
    `);
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
    const [students] = await db.query(
      'SELECT id FROM students WHERE user_id = ?',
      [req.params.userId]
    );
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    const studentId = students[0].id;
    
    // Ahora obtenemos los planes de mejoramiento
    const [plans] = await db.query(`
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
    const [teachers] = await db.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [req.params.userId]
    );
    
    if (teachers.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    const teacherId = teachers[0].id;
    
    // Ahora obtenemos los planes de mejoramiento
    const [plans] = await db.query(`
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

// Obtener un plan de mejoramiento específico
router.get('/improvement-plans/:id', async (req, res) => {
  try {
    const [plans] = await db.query(`
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
    const [studentCheck] = await db.query('SELECT * FROM students WHERE id = ?', [student_id]);
    if (studentCheck.length === 0) {
      return res.status(400).json({ message: 'El estudiante no existe' });
    }
    
    // Verificar que teacher_id existe
    const [teacherCheck] = await db.query('SELECT * FROM teachers WHERE id = ?', [teacher_id]);
    if (teacherCheck.length === 0) {
      return res.status(400).json({ message: 'El profesor no existe' });
    }
    
    // Obtener el email del estudiante para notificación
    const [studentData] = await db.query(
      'SELECT contact_email FROM students WHERE id = ?',
      [student_id]
    );
    const studentEmail = studentData[0]?.contact_email;
    
    // Insertar el plan de mejoramiento
    const [result] = await db.query(
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
    const [planCheck] = await db.query('SELECT * FROM improvement_plans WHERE id = ?', [id]);
    if (planCheck.length === 0) {
      return res.status(404).json({ message: 'Plan de mejoramiento no encontrado' });
    }
    
    // Actualizar el plan
    await db.query(
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
    const [planCheck] = await db.query('SELECT * FROM improvement_plans WHERE id = ?', [id]);
    if (planCheck.length === 0) {
      return res.status(404).json({ message: 'Plan de mejoramiento no encontrado' });
    }
    
    // Eliminar el plan
    await db.query('DELETE FROM improvement_plans WHERE id = ?', [id]);
    
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
    
    // Obtener indicadores no alcanzados para este estudiante en esta fase
    const [indicators] = await db.query(`
      SELECT i.id, i.description, i.subject, i.phase, i.grade, i.achieved
      FROM indicators i
      JOIN teacher_students ts ON i.teacher_id = ts.teacher_id
      WHERE ts.student_id = ? AND i.grade = ? AND i.phase = ? AND i.achieved = false
      ORDER BY i.subject
    `, [studentId, grade, phase]);
    
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
    const [indicators] = await db.query(`
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

// Obtener plantillas de descripción para planes de mejoramiento
router.get('/improvement-plans/templates', async (req, res) => {
  try {
    const [templates] = await db.query(`
      SELECT DISTINCT description 
      FROM improvement_plans 
      WHERE description IS NOT NULL AND description != ''
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    res.json(templates);
  } catch (error) {
    console.error('Error al obtener plantillas de descripción:', error);
    res.status(500).json({ message: 'Error al obtener plantillas de descripción' });
  }
});

// Añadir esta nueva ruta para obtener planes por student_id directamente
router.get('/improvement-plans/student-id/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Obtener planes de mejoramiento usando directamente el student_id
    const [plans] = await db.query(`
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
    
    const [resources] = await db.query(`
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
    const [planCheck] = await db.query('SELECT * FROM improvement_plans WHERE id = ?', [id]);
    if (planCheck.length === 0) {
      return res.status(404).json({ message: 'Plan de mejoramiento no encontrado' });
    }
    
    const [result] = await db.query(`
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
    
    await db.query(`
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
    
    await db.query('DELETE FROM recovery_resources WHERE id = ?', [resourceId]);
    
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
    
    await db.query(`
      UPDATE recovery_resources 
      SET viewed = 1, viewed_at = NOW(), completion_percentage = ?
      WHERE id = ?
    `, [completion_percentage || 100, resourceId]);
    
    // Registrar en el progreso
    await db.query(`
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
    
    const [activities] = await db.query(`
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
    const [planCheck] = await db.query('SELECT * FROM improvement_plans WHERE id = ?', [id]);
    if (planCheck.length === 0) {
      return res.status(404).json({ message: 'Plan de mejoramiento no encontrado' });
    }
    
    const [result] = await db.query(`
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
    
    await db.query(`
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
    
    await db.query('DELETE FROM recovery_activities WHERE id = ?', [activityId]);
    
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
    const [activity] = await db.query(`
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
    await db.query(`
      UPDATE recovery_activities 
      SET status = ?, student_score = ?, attempts_count = attempts_count + 1,
          completed_at = NOW(), student_notes = ?
      WHERE id = ?
    `, [newStatus, score, student_notes, activityId]);
    
    // Registrar en el progreso
    await db.query(`
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
    
    const [progress] = await db.query(`
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
    const [stats] = await db.query(`
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

export default router;
