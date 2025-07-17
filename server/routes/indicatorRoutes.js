// routes/indicatorRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Obtener todos los indicadores (con filtros opcionales)
router.get('/', verifyToken, async (req, res) => {
  const { teacher_id, student_id, subject, phase } = req.query;
  console.log('🔍 Iniciando consulta de indicadores con filtros:', req.query);

  try {
    // Si se proporciona un teacher_id, validar que exista
    if (teacher_id) {
      console.log(`🔍 Validando docente con ID: ${teacher_id}`);

      
      // Validar que el teacher_id sea un número
      if (isNaN(teacher_id)) {
        console.error('❌ ID de docente no válido:', teacher_id);
        return res.status(400).json({
          success: false,
          message: 'ID de docente no válido',
          teacher_id
        });
      }
      
      const [teacher] = await pool.query(
        `SELECT t.id, t.user_id, u.name, u.email 
         FROM teachers t 
         JOIN users u ON t.user_id = u.id 
         WHERE t.id = ?`, 
        [teacher_id]
      );
      
      if (teacher.length === 0) {
        console.error(`❌ No se encontró docente con ID: ${teacher_id}`);
        return res.status(404).json({ 
          success: false, 
          message: 'Docente no encontrado',
          teacher_id: teacher_id
        });
      }
      console.log(`✅ Docente encontrado:`, teacher[0]);
    }
    
    // Construir la consulta SQL según la estructura real de la tabla
    let query = `
      SELECT 
        i.id,
        i.description,
        i.subject,
        i.phase,
        i.achieved,
        i.created_at,
        i.teacher_id,
        i.student_id,
        t.subject as teacher_subject, 
        u.name as teacher_name,
        u.email as teacher_email
      FROM indicators i
      LEFT JOIN teachers t ON i.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN students s ON i.student_id = s.id
      WHERE 1=1
    `;
    
    console.log('🔍 Consulta SQL base construida');
    
    const params = [];
    
    if (teacher_id) {
      console.log(`🔍 Aplicando filtro por teacher_id: ${teacher_id}`);
      query += ' AND i.teacher_id = ?';
      params.push(teacher_id);
    }
    
    if (student_id) {
      query += ' AND (i.student_id = ? OR i.student_id IS NULL)';
      params.push(student_id);
    }
    
    if (subject) {
      query += ' AND i.subject = ?';
      params.push(subject);
    }
    
    if (phase) {
      query += ' AND i.phase = ?';
      params.push(phase);
    }
    
    query += ' ORDER BY i.phase, i.created_at DESC';
    
    console.log('🔍 Ejecutando consulta SQL:', query.replace(/\s+/g, ' ').trim());
    console.log('📌 Parámetros:', params);
    
    try {
      console.log('🔍 Ejecutando consulta SQL final:', query);
      console.log('📌 Parámetros finales:', params);
      
      // Verificar la conexión a la base de datos
      const connection = await pool.getConnection();
      console.log('✅ Conexión a la base de datos establecida correctamente');
      
      try {
        // Ejecutar la consulta
        const [rows] = await connection.query(query, params);
        console.log(`✅ Se encontraron ${rows.length} indicadores`);
        
        if (rows.length > 0) {
          console.log('📝 Muestra del primer indicador encontrado:', {
            id: rows[0].id,
            description: rows[0].description,
            teacher_id: rows[0].teacher_id,
            student_id: rows[0].student_id,
            subject: rows[0].subject,
            phase: rows[0].phase
          });
        } else {
          console.log('ℹ️ No se encontraron indicadores con los filtros proporcionados');
        }
      
        // Asegurarnos de que la respuesta tenga el formato correcto
        const response = {
          success: true,
          count: rows.length,
          data: rows
        };
        
        // Liberar la conexión
        connection.release();
        
        console.log('✅ Respuesta preparada correctamente');
        return res.json(response);
        
      } catch (queryError) {
        console.error('❌ Error al ejecutar la consulta SQL:', queryError);
        console.error('🔍 Detalles del error:', {
          code: queryError.code,
          errno: queryError.errno,
          sqlMessage: queryError.sqlMessage,
          sqlState: queryError.sqlState,
          sql: queryError.sql
        });
        
        // Liberar la conexión en caso de error
        if (connection) connection.release();
        
        // Devolver un error más descriptivo
        return res.status(500).json({
          success: false,
          message: 'Error al ejecutar la consulta en la base de datos',
          error: {
            code: queryError.code,
            message: queryError.message,
            sqlMessage: queryError.sqlMessage,
            sqlState: queryError.sqlState
          }
        });
      }
    } catch (connectionError) {
      console.error('❌ Error de conexión a la base de datos:', connectionError);
      return res.status(500).json({
        success: false,
        message: 'Error al conectar con la base de datos',
        error: connectionError.message
      });
      console.error('❌ Error al ejecutar la consulta SQL:', error);
      console.error('🔍 Detalles del error:', {
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage,
        sqlState: error.sqlState,
        sql: error.sql
      });
      
      // Devolver un error más descriptivo
      res.status(500).json({
        success: false,
        message: 'Error al ejecutar la consulta en la base de datos',
        error: {
          code: error.code,
          message: error.message,
          sqlMessage: error.sqlMessage,
          sqlState: error.sqlState
        }
      });
      return;
    }
  } catch (error) {
    console.error('❌ Error al obtener indicadores:', error);
    res.status(500).json({ message: 'Error al obtener indicadores' });
  }
});

// Obtener un indicador específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Obteniendo indicador con ID: ${id}`);
    
    const [rows] = await pool.query(`
      SELECT 
        i.*, 
        t.subject as teacher_subject, 
        u.name as teacher_name,
        -- Obtener el nombre del estudiante desde la tabla users
        (SELECT name FROM users WHERE id = s.user_id) as student_name,
        -- Obtener el grado del estudiante desde la tabla students
        s.grade as student_grade
      FROM indicators i
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN students s ON i.student_id = s.id
      WHERE i.id = ?
    `, [id]);
    
    console.log(`✅ Resultado de la consulta:`, rows[0]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Indicador no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error al obtener indicador:', error);
    res.status(500).json({ message: 'Error al obtener indicador' });
  }
});

// Crear un nuevo indicador
router.post('/', async (req, res) => {
  try {
    const { teacher_id, student_id, description, subject, phase, achieved } = req.body;
    
    const [result] = await pool.query(`
      INSERT INTO indicators 
      (teacher_id, student_id, description, subject, phase, achieved) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [teacher_id, student_id || null, description, subject, phase, achieved || 0]);
    
    res.status(201).json({
      id: result.insertId,
      message: 'Indicador creado correctamente'
    });
  } catch (error) {
    console.error('❌ Error al crear indicador:', error);
    res.status(500).json({ message: 'Error al crear indicador' });
  }
});


// Actualizar un indicador existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { description, subject, phase, achieved, questionnaire_id, grade } = req.body;
    // Eliminar esta línea: alert(grade);
    console.log("Grade recibido:", grade);
    
    await pool.query(`
      UPDATE indicators 
      SET description = ?, subject = ?, phase = ?, achieved = ?, questionnaire_id = ?, grade = ?
      WHERE id = ?
    `, [description, subject, phase, achieved, questionnaire_id, grade || null, id]);
    
    res.json({ message: 'Indicador actualizado correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar indicador:', error);
    res.status(500).json({ message: 'Error al actualizar indicador' });
  }
});


// Eliminar un indicador
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM indicators WHERE id = ?', [id]);
    
    res.json({ message: 'Indicador eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar indicador:', error);
    res.status(500).json({ message: 'Error al eliminar indicador' });
  }
});

// Obtener cuestionarios para el combo box - MODIFICADO para usar user_id en lugar de teacher_id
router.get('/questionnaires/teacher/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Buscando cuestionarios para el usuario ID:", userId);
    
    // Primero obtener el ID del profesor a partir del ID de usuario
    const [teacherRows] = await pool.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    const teacherId = teacherRows[0].id;
    console.log("ID del profesor encontrado:", teacherId);
    
    // Ahora obtener los cuestionarios usando el ID correcto del profesor
    const [rows] = await pool.query(`
      SELECT q.id, q.title, q.grade, q.phase, q.category, q.created_by, q.course_id
      FROM questionnaires q
      WHERE q.created_by = ?
      ORDER BY q.created_at DESC
    `, [teacherId]);
    
    console.log("Cuestionarios encontrados:", rows.length);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error detallado al obtener cuestionarios:', error.message, error.stack);
    res.status(500).json({ message: 'Error al obtener cuestionarios', error: error.message });
  }
});

// Obtener indicadores para un estudiante específico
// Obtener indicadores para un estudiante específico
router.get('/student/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Obtener el ID y grado del estudiante
    const [studentRows] = await pool.query(
      'SELECT id, grade FROM students WHERE user_id = ?',
      [userId]
    );
    
    if (studentRows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    const studentId = studentRows[0].id;
    const studentGrade = studentRows[0].grade;
    
    // Obtener indicadores para el estudiante con filtrado mejorado
    const [rows] = await pool.query(`
      SELECT 
        i.*, 
        t.subject as teacher_subject, 
        u.name as teacher_name,
        q.title as questionnaire_title, 
        q.grade as questionnaire_grade, 
        q.phase as questionnaire_phase,
        s.name as student_name,
        s.grade as student_grade,
        c.name as course_name
      FROM indicators i
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN questionnaires q ON i.questionnaire_id = q.id
      LEFT JOIN students s ON i.student_id = s.id
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE (
        i.student_id = ? 
        OR (i.student_id IS NULL AND (i.grade = ? OR i.grade IS NULL))
      )
      ORDER BY i.phase, i.created_at DESC
    `, [studentId, studentGrade]);
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener indicadores del estudiante:', error);
    res.status(500).json({ message: 'Error al obtener indicadores del estudiante' });
  }
});


// Añade esta ruta a tu archivo indicatorRoutes.js
router.get('/subjects/teacher/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Obtener el ID del profesor a partir del ID de usuario
    const [teacherRows] = await pool.query(
      'SELECT id, subject FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    res.json({ subject: teacherRows[0].subject });
  } catch (error) {
    console.error('❌ Error al obtener materia del profesor:', error);
    res.status(500).json({ message: 'Error al obtener materia del profesor' });
  }
});


export default router;
