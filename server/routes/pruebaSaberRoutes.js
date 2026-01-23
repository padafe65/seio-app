// routes/pruebaSaberRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/prueba-saber/results
 * Obtener resultados de Prueba Saber
 * - Estudiante: solo sus resultados
 * - Docente/Admin: resultados de sus estudiantes
 * - Super Admin: todos los resultados
 */
router.get('/results', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { level, student_id, course_id, institution } = req.query;
    const userRole = req.user.role;
    
    let query = `
      SELECT 
        er.id,
        er.student_id,
        er.questionnaire_id,
        er.best_score,
        er.phase,
        er.recorded_at,
        er.academic_year,
        q.title as questionnaire_title,
        q.prueba_saber_level,
        q.grade as questionnaire_grade,
        q.subject,
        q.category,
        u.name as student_name,
        s.grade as student_grade,
        c.name as course_name,
        u.institution as student_institution,
        -- Obtener todos los intentos del estudiante para este cuestionario
        (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.student_id = er.student_id AND qa.questionnaire_id = er.questionnaire_id) as total_attempts
      FROM evaluation_results er
      JOIN questionnaires q ON er.questionnaire_id = q.id
      JOIN students s ON er.student_id = s.id
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.user_id = u.id
      WHERE q.is_prueba_saber = 1
    `;
    
    const params = [];
    
    // Si es estudiante, solo mostrar sus resultados
    if (userRole === 'estudiante') {
      const [students] = await connection.query(
        'SELECT id FROM students WHERE user_id = ?',
        [req.user.id]
      );
      
      if (students.length === 0) {
        return res.json({ success: true, data: [] });
      }
      
      query += ` AND er.student_id = ?`;
      params.push(students[0].id);
    }
    
    // Si es docente, mostrar resultados de sus estudiantes
    if (userRole === 'docente') {
      const [teachers] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teachers.length === 0) {
        return res.json({ success: true, data: [] });
      }
      
      // Filtrar por estudiantes del docente a través de teacher_students
      query += ` AND er.student_id IN (
        SELECT student_id FROM teacher_students WHERE teacher_id = ?
      )`;
      params.push(teachers[0].id);
    }
    
    // Filtrar por nivel si se especifica
    if (level) {
      const levelInt = parseInt(level);
      if ([3, 5, 9, 11].includes(levelInt)) {
        query += ` AND q.prueba_saber_level = ?`;
        params.push(levelInt);
      }
    }
    
    // Filtrar por estudiante específico (solo para admin/super_admin/docente)
    if ((userRole === 'administrador' || userRole === 'super_administrador' || userRole === 'docente') && student_id) {
      query += ` AND er.student_id = ?`;
      params.push(parseInt(student_id));
    }
    
    // Filtrar por curso (solo para admin/super_admin/docente)
    if ((userRole === 'administrador' || userRole === 'super_administrador' || userRole === 'docente') && course_id) {
      query += ` AND s.course_id = ?`;
      params.push(parseInt(course_id));
    }
    
    // Filtrar por institución (solo para admin/super_admin/docente)
    if ((userRole === 'administrador' || userRole === 'super_administrador' || userRole === 'docente') && institution) {
      query += ` AND u.institution = ?`;
      params.push(institution);
    } else if (userRole === 'docente') {
      // Para docentes, filtrar automáticamente por su institución
      const [userInfo] = await connection.query(
        'SELECT institution FROM users WHERE id = ?',
        [req.user.id]
      );
      
      if (userInfo.length > 0 && userInfo[0].institution) {
        query += ` AND u.institution = ?`;
        params.push(userInfo[0].institution);
      }
    }
    
    query += ` ORDER BY q.prueba_saber_level ASC, er.recorded_at DESC`;
    
    const [results] = await connection.query(query, params);
    
    // Obtener detalles de intentos para cada resultado
    const resultsWithAttempts = await Promise.all(results.map(async (result) => {
      const [attempts] = await connection.query(
        `SELECT id, attempt_number, score, created_at 
         FROM quiz_attempts 
         WHERE student_id = ? AND questionnaire_id = ? 
         ORDER BY attempt_number ASC`,
        [result.student_id, result.questionnaire_id]
      );
      
      return {
        ...result,
        attempts: attempts
      };
    }));
    
    res.json({
      success: true,
      count: resultsWithAttempts.length,
      data: resultsWithAttempts
    });
    
  } catch (error) {
    console.error('❌ Error al obtener resultados Prueba Saber:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resultados Prueba Saber',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/prueba-saber/results/student/:studentId
 * Obtener resultados de Prueba Saber de un estudiante específico
 */
router.get('/results/student/:studentId', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { studentId } = req.params;
    const userRole = req.user.role;
    
    // Verificar permisos
    if (userRole === 'estudiante') {
      const [students] = await connection.query(
        'SELECT id FROM students WHERE user_id = ?',
        [req.user.id]
      );
      
      if (students.length === 0 || students[0].id !== parseInt(studentId)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver estos resultados'
        });
      }
    }
    
    const [results] = await connection.query(
      `SELECT 
        er.*,
        q.title as questionnaire_title,
        q.prueba_saber_level,
        q.grade as questionnaire_grade,
        q.subject,
        c.name as course_name
      FROM evaluation_results er
      JOIN questionnaires q ON er.questionnaire_id = q.id
      JOIN students s ON er.student_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE q.is_prueba_saber = 1 AND er.student_id = ?
      ORDER BY q.prueba_saber_level ASC, er.recorded_at DESC`,
      [studentId]
    );
    
    // Obtener intentos para cada resultado
    const resultsWithAttempts = await Promise.all(results.map(async (result) => {
      const [attempts] = await connection.query(
        `SELECT id, attempt_number, score, created_at 
         FROM quiz_attempts 
         WHERE student_id = ? AND questionnaire_id = ? 
         ORDER BY attempt_number ASC`,
        [result.student_id, result.questionnaire_id]
      );
      
      return {
        ...result,
        attempts: attempts
      };
    }));
    
    res.json({
      success: true,
      count: resultsWithAttempts.length,
      data: resultsWithAttempts
    });
    
  } catch (error) {
    console.error('❌ Error al obtener resultados del estudiante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resultados del estudiante',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

export default router;
