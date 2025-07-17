// routes/improvementPlans.js
import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener todos los planes de mejoramiento
router.get('/', async (req, res) => {
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
router.get('/student/:userId', async (req, res) => {
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
router.get('/teacher/:userId', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
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
      passed_achievements 
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
        file_url, failed_achievements, passed_achievements, completed, email_sent, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, false, NOW())`,
      [student_id, teacher_id, title, subject, description, activities, deadline, 
       file_url, failed_achievements, passed_achievements]
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
router.put('/:id', async (req, res) => {
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
           completed = ?, email_sent = ?
       WHERE id = ?`,
      [title, subject, description, activities, deadline, file_url, 
       failed_achievements, passed_achievements, completed, email_sent, id]
    );
    
    res.json({ message: 'Plan de mejoramiento actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar plan de mejoramiento:', error);
    res.status(500).json({ message: 'Error al actualizar plan de mejoramiento' });
  }
});

// Eliminar un plan de mejoramiento
router.delete('/:id', async (req, res) => {
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
router.get('/indicators/failed/:studentId/:grade/:phase', async (req, res) => {
  try {
    const { studentId, grade, phase } = req.params;
    
    // Obtener indicadores no alcanzados para este estudiante en esta fase
    const [indicators] = await db.query(`
      SELECT 
        i.id, 
        i.description, 
        i.subject, 
        i.phase, 
        i.grade, 
        i.achieved,
        t.subject as teacher_subject,
        u.name as teacher_name,
        q.title as questionnaire_title,
        q.phase as questionnaire_phase,
        c.name as course_name
      FROM indicators i
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN questionnaires q ON i.questionnaire_id = q.id
      LEFT JOIN courses c ON q.course_id = c.id
      JOIN teacher_students ts ON i.teacher_id = ts.teacher_id
      WHERE ts.student_id = ? 
        AND i.grade = ? 
        AND i.phase = ? 
        AND i.achieved = false
      ORDER BY i.subject, i.created_at DESC
    `, [studentId, grade, phase]);
    
    res.json(indicators);
  } catch (error) {
    console.error('Error al obtener indicadores no alcanzados:', error);
    res.status(500).json({ message: 'Error al obtener indicadores no alcanzados' });
  }
});

// Obtener indicadores alcanzados por estudiante, grado y fase
router.get('/indicators/passed/:studentId/:grade/:phase', async (req, res) => {
  try {
    const { studentId, grade, phase } = req.params;
    
    // Obtener indicadores alcanzados para este estudiante en esta fase
    const [indicators] = await db.query(`
      SELECT 
        i.id, 
        i.description, 
        i.subject, 
        i.phase, 
        i.grade, 
        i.achieved,
        t.subject as teacher_subject,
        u.name as teacher_name,
        q.title as questionnaire_title,
        q.phase as questionnaire_phase,
        c.name as course_name
      FROM indicators i
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN questionnaires q ON i.questionnaire_id = q.id
      LEFT JOIN courses c ON q.course_id = c.id
      JOIN teacher_students ts ON i.teacher_id = ts.teacher_id
      WHERE ts.student_id = ? 
        AND i.grade = ? 
        AND i.phase = ? 
        AND i.achieved = true
      ORDER BY i.subject, i.created_at DESC
    `, [studentId, grade, phase]);
    
    res.json(indicators);
  } catch (error) {
    console.error('Error al obtener indicadores alcanzados:', error);
    res.status(500).json({ message: 'Error al obtener indicadores alcanzados' });
  }
});

// Obtener plantillas de descripción para planes de mejoramiento
router.get('/templates', async (req, res) => {
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
router.get('/student-id/:studentId', async (req, res) => {
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


export default router;
