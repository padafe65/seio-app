// routes/indicatorRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Obtener todos los indicadores (con filtros opcionales)
router.get('/', verifyToken, async (req, res) => {
  const { teacher_id, student_id, subject, phase, questionnaire_id } = req.query;
  console.log('🔍 Iniciando consulta de indicadores con filtros:', req.query);

  try {
    // Validar teacher_id si se proporciona
    if (teacher_id) {
      console.log(`🔍 Validando docente con ID: ${teacher_id}`);
      
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
          teacher_id
        });
      }
      console.log(`✅ Docente encontrado:`, teacher[0]);
    }
    
    // Construir la consulta base para obtener indicadores
    let query = `
      SELECT DISTINCT
        i.id,
        i.description,
        i.subject,
        i.phase,
        i.created_at,
        i.teacher_id,
        si.questionnaire_id,
        q.title as questionnaire_title,
        t.subject as teacher_subject, 
        u.name as teacher_name,
        u.email as teacher_email,
        GROUP_CONCAT(DISTINCT CONCAT(si.student_id, '|', 
          IFNULL((SELECT name FROM users WHERE id = s.user_id), ''), '|', 
          IFNULL(s.grade, '')) SEPARATOR ';') as students_info
      FROM indicators i
      LEFT JOIN teachers t ON i.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN student_indicators si ON i.id = si.indicator_id
      LEFT JOIN students s ON si.student_id = s.id
      LEFT JOIN questionnaires q ON si.questionnaire_id = q.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Aplicar filtros
    if (teacher_id) {
      query += ' AND i.teacher_id = ?';
      params.push(teacher_id);
    }
    
    if (student_id) {
      query += ' AND si.student_id = ?';
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
    
    if (questionnaire_id) {
      query += ' AND i.questionnaire_id = ?';
      params.push(questionnaire_id);
    }
    
    // Agrupar por indicador para manejar múltiples estudiantes
    query += ' GROUP BY i.id';
    query += ' ORDER BY i.phase, i.created_at DESC';
    
    console.log('🔍 Ejecutando consulta SQL:', query.replace(/\s+/g, ' ').trim());
    console.log('📌 Parámetros:', params);
    
    try {
      const [rows] = await pool.query(query, params);
      console.log(`✅ Se encontraron ${rows.length} indicadores`);
      
      // Procesar los estudiantes asociados a cada indicador
      const processedRows = rows.map(row => {
        const studentsData = [];
        if (row.students_info) {
          const studentEntries = row.students_info.split(';');
          studentEntries.forEach(entry => {
            const [id, name, grade] = entry.split('|');
            if (id && id !== 'null') {
              studentsData.push({
                id: parseInt(id),
                name: name || 'Estudiante sin nombre',
                grade: grade || ''
              });
            }
          });
        }
        
        return {
          ...row,
          students: studentsData,
          student_count: studentsData.length,
          questionnaire: row.questionnaire_id ? {
            id: row.questionnaire_id,
            title: row.questionnaire_title
          } : null
        };
      });
      
      const response = {
        success: true,
        count: processedRows.length,
        data: processedRows
      };
      
      return res.json(response);
      
    } catch (queryError) {
      console.error('❌ Error al ejecutar la consulta SQL:', queryError);
      console.error('🔍 Detalles del error:', {
        code: queryError.code,
        sqlMessage: queryError.sqlMessage,
        sql: queryError.sql
      });
      
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
  } catch (error) {
    console.error('❌ Error al obtener indicadores:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener indicadores',
      error: error.message 
    });
  }
});

// Obtener un indicador específico con sus estudiantes asociados
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Obteniendo indicador con ID: ${id}`);
    
    // Obtener la información básica del indicador
    const [indicatorRows] = await pool.query(`
      SELECT 
        i.*, 
        t.subject as teacher_subject, 
        u.name as teacher_name,
        u.email as teacher_email
      FROM indicators i
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE i.id = ?
    `, [id]);
    
    if (indicatorRows.length === 0) {
      console.log(`❌ No se encontró el indicador con ID: ${id}`);
      return res.status(404).json({ 
        success: false,
        message: 'Indicador no encontrado' 
      });
    }
    
    // Obtener los estudiantes asociados a este indicador
    const [studentRows] = await pool.query(`
      SELECT 
        s.id,
        u.name as student_name,
        s.grade,
        si.achieved,
        si.assigned_at,
        si.id as assignment_id
        si.assigned_at,
        si.id as assignment_id
      FROM student_indicators si
      JOIN students s ON si.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE si.indicator_id = ?
      ORDER BY u.name
    `, [id]);
    
    // Procesar los estudiantes para el formato de respuesta
    const students = studentRows.map(row => ({
      id: row.id,
      name: row.student_name,
      grade: row.grade,
      achieved: row.achieved === 1,
      assigned_at: row.assigned_at
    }));
    
    // Obtener los IDs de los estudiantes ya asignados para facilitar el filtrado
    const assignedStudentIds = studentRows.map(student => student.id);
    
    // Combinar la información del indicador con los estudiantes
    const indicatorData = {
      ...indicatorRows[0],
      students: students,
      assignedStudentIds // Añadimos los IDs de los estudiantes asignados
    };
    
    console.log(`✅ Indicador ${id} obtenido correctamente con ${studentRows.length} estudiantes asignados`);
    
    res.json({
      success: true,
      data: indicatorData
    });
    
  } catch (error) {
    console.error('❌ Error al obtener indicador:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener indicador',
      error: error.message 
    });
  }
});

// Crear un nuevo indicador con un estudiante asociado (opcional)
router.post('/', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { 
      teacher_id, 
      student_id = null, // Cambiado a student_id singular
      description, 
      subject, 
      phase, 
      achieved = false,
      questionnaire_id = null,
      grade
    } = req.body;
    
    console.log('📝 Datos recibidos para crear indicador:', {
      teacher_id,
      student_id,
      description_length: description?.length,
      subject,
      phase,
      grade,
      achieved,
      questionnaire_id
    });
    
    // Validar campos requeridos
    if (!teacher_id || !description || !subject || !phase || !grade) {
      throw new Error('Faltan campos requeridos');
    }
    
    // Validar que el docente existe
    const [teacher] = await connection.query(
      'SELECT id FROM teachers WHERE id = ?', 
      [teacher_id]
    );
    
    if (teacher.length === 0) {
      throw new Error('El docente especificado no existe');
    }

    // Validar questionnaire_id si se proporciona
    if (questionnaire_id) {
      const [questionnaire] = await connection.query(
        'SELECT id FROM questionnaires WHERE id = ? AND created_by = ?',
        [questionnaire_id, teacher_id]
      );
      
      if (questionnaire.length === 0) {
        throw new Error('El cuestionario especificado no existe o no pertenece al docente');
      }
    }
    
    // Validar student_id si se proporciona
    if (student_id) {
      const [student] = await connection.query(
        'SELECT id FROM students WHERE id = ?',
        [student_id]
      );
      
      if (student.length === 0) {
        throw new Error('El estudiante especificado no existe');
      }
    }
    
    // Crear el indicador
    const [result] = await connection.query(`
      INSERT INTO indicators 
      (teacher_id, description, subject, phase, questionnaire_id, grade) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      teacher_id, 
      description, 
      subject, 
      phase, 
      questionnaire_id,
      grade
    ]);
    
    const indicatorId = result.insertId;
    console.log(`✅ Indicador creado con ID: ${indicatorId}`);
    
    // Si se proporcionó un estudiante, asociarlo al indicador
    if (student_id) {
      console.log(`🔗 Asociando estudiante ${student_id} al indicador...`);
      
      await connection.query(`
        INSERT INTO student_indicators 
        (student_id, indicator_id, achieved, assigned_at) 
        VALUES (?, ?, ?, ?)
      `, [
        student_id,
        indicatorId,
        achieved ? 1 : 0,
        new Date()
      ]);
      
      console.log('✅ Estudiante asociado al indicador');
    }
    
    await connection.commit();
    
    // Obtener el indicador creado para la respuesta
    const [newIndicator] = await connection.query(`
      SELECT i.*, 
        t.subject as teacher_subject,
        u.name as teacher_name
      FROM indicators i
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE i.id = ?
    `, [indicatorId]);
    
    res.status(201).json({
      success: true,
      id: indicatorId,
      data: newIndicator[0],
      message: 'Indicador creado correctamente'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear indicador:', error);
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Error al crear indicador'
    });
  } finally {
    connection.release();
  }
});


// Actualizar un indicador existente con sus estudiantes asociados
router.put('/:id', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { 
      description, 
      subject, 
      phase, 
      achieved = false,
      questionnaire_id = null,
      student_ids = [] // Array de IDs de estudiantes actualizado
    } = req.body;
    
    console.log(`🔄 Actualizando indicador ID: ${id}`, {
      description_length: description?.length,
      subject,
      phase,
      achieved,
      questionnaire_id,
      student_count: student_ids?.length || 0,
      grade
    });

    // 1. Actualizar la información básica del indicador
    await connection.query(`
      UPDATE indicators 
      SET 
        description = COALESCE(?, description),
        subject = COALESCE(?, subject),
        phase = COALESCE(?, phase),
        grade = COALESCE(?, grade)
      WHERE id = ?
    `, [description, subject, phase, grade, id]);
    
    console.log(`✅ Información básica del indicador ${id} actualizada`);
    
    // 2. Si se proporcionaron estudiantes, actualizar las relaciones
    if (Array.isArray(student_ids)) {
      console.log(`🔄 Actualizando estudiantes asociados al indicador ${id}...`);
      
      // Obtener estudiantes actuales
      const [currentStudents] = await connection.query(
        'SELECT student_id FROM student_indicators WHERE indicator_id = ?',
        [id]
      );
      
      const currentStudentIds = currentStudents.map(s => s.student_id);
      const newStudentIds = student_ids;
      
      // Identificar estudiantes a eliminar
      const studentsToRemove = currentStudentIds.filter(id => !newStudentIds.includes(id));
      
      // Identificar estudiantes a agregar
      const studentsToAdd = newStudentIds.filter(id => !currentStudentIds.includes(id));
      
      // Eliminar relaciones que ya no existen
      if (studentsToRemove.length > 0) {
        await connection.query(
          'DELETE FROM student_indicators WHERE indicator_id = ? AND student_id IN (?)',
          [id, studentsToRemove]
        );
        console.log(`🗑️  Eliminadas ${studentsToRemove.length} relaciones de estudiantes`);
      }
      
      // Agregar nuevas relaciones
      if (studentsToAdd.length > 0) {
        // Validar que los estudiantes existan
        const [existingStudents] = await connection.query(
          'SELECT id FROM students WHERE id IN (?)',
          [studentsToAdd]
        );
        
        const existingStudentIds = new Set(existingStudents.map(s => s.id));
        const invalidStudentIds = studentsToAdd.filter(id => !existingStudentIds.has(id));
        
        if (invalidStudentIds.length > 0) {
          throw new Error(`Los siguientes IDs de estudiantes no son válidos: ${invalidStudentIds.join(', ')}`);
        }
        
        // Insertar nuevas relaciones
        const studentValues = studentsToAdd.map(studentId => [
          studentId,
          id,
          achieved ? 1 : 0, // Convertir a 1/0 para MySQL
          new Date() // assigned_at
        ]);
        
        await connection.query(
          'INSERT INTO student_indicators (student_id, indicator_id, achieved, assigned_at) VALUES ?',
          [studentValues]
        );
        
        console.log(`✅ Añadidas ${studentsToAdd.length} nuevas relaciones de estudiantes`);
      }
      
      // Actualizar el estado 'achieved' para todos los estudiantes asociados
      await connection.query(
        'UPDATE student_indicators SET achieved = ? WHERE indicator_id = ?',
        [achieved ? 1 : 0, id]
      );
    }

    await connection.commit();
    
    // Obtener el indicador actualizado con sus relaciones
    const [updatedIndicator] = await connection.query(`
      SELECT i.*, 
        t.subject as teacher_subject,
        u.name as teacher_name,
        GROUP_CONCAT(DISTINCT si.student_id) as student_ids,
        si.questionnaire_id,
        q.title as questionnaire_title
      FROM indicators i
      LEFT JOIN teachers t ON i.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN student_indicators si ON i.id = si.indicator_id
      LEFT JOIN questionnaires q ON si.questionnaire_id = q.id
      WHERE i.id = ?
      GROUP BY i.id
    `, [id]);
    
    res.json({
      success: true,
      data: {
        ...updatedIndicator[0],
        questionnaire: updatedIndicator[0].questionnaire_id ? {
          id: updatedIndicator[0].questionnaire_id,
          title: updatedIndicator[0].questionnaire_title
        } : null
      },
      message: 'Indicador actualizado correctamente'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al actualizar indicador:', error);
    
    res.status(500).json({ 
      success: false,
      message: 'Error al actualizar indicador',
      error: error.message 
    });
  } finally {
    connection.release();
  }
});


// Eliminar un indicador y sus relaciones con estudiantes
router.delete('/:id', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    console.log(`🗑️  Solicitada eliminación del indicador ID: ${id}`);
    
    // 1. Verificar que el indicador existe
    const [indicator] = await connection.query(
      'SELECT id FROM indicators WHERE id = ?',
      [id]
    );
    
    if (indicator.length === 0) {
      console.log(`❌ No se encontró el indicador con ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'El indicador especificado no existe'
      });
    }
    
    // 2. Eliminar las relaciones con estudiantes primero (por restricciones de clave foránea)
    await connection.query(
      'DELETE FROM student_indicators WHERE indicator_id = ?',
      [id]
    );
    
    console.log(`✅ Relaciones de estudiantes eliminadas para el indicador ${id}`);
    
    // 3. Ahora eliminar el indicador
    await connection.query(
      'DELETE FROM indicators WHERE id = ?',
      [id]
    );
    
    await connection.commit();
    
    console.log(`✅ Indicador ${id} eliminado correctamente`);
    
    res.json({
      success: true,
      message: 'Indicador eliminado correctamente',
      id: parseInt(id)
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al eliminar indicador:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error al eliminar indicador',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Obtener cuestionarios para el combo box
router.get('/questionnaires/teacher/:userId', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { userId } = req.params;
    console.log("🔍 Buscando cuestionarios para el usuario ID:", userId);
    
    // 1. Obtener el ID del profesor a partir del ID de usuario
    const [teacherRows] = await connection.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (teacherRows.length === 0) {
      console.log(`❌ No se encontró un profesor con user_id: ${userId}`);
      return res.status(404).json({ 
        success: false,
        message: 'Profesor no encontrado' 
      });
    }
    
    const teacherId = teacherRows[0].id;
    console.log("✅ ID del profesor encontrado:", teacherId);
    
    // 2. Obtener los cuestionarios creados por este profesor
    const [rows] = await connection.query(`
      SELECT 
        q.id, 
        q.title,
        q.description,
        q.grade, 
        q.phase, 
        q.created_at,
        q.course_id,
        c.name as course_name
      FROM questionnaires q
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE q.created_by = ?
      ORDER BY q.created_at DESC
    `, [teacherId]);
    
    console.log(`✅ Se encontraron ${rows.length} cuestionarios para el profesor ${teacherId}`);
    
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
    
  } catch (error) {
    console.error('❌ Error al obtener cuestionarios:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener cuestionarios', 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// Obtener indicadores para un estudiante específico
router.get('/student/:userId', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { userId } = req.params;
    console.log(`🔍 Obteniendo indicadores para el estudiante con user_id: ${userId}`);
    
    // 1. Obtener la información básica del estudiante
    const [studentRows] = await connection.query(`
      SELECT s.id, s.grade, u.name as student_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ?
    `, [userId]);
    
    if (studentRows.length === 0) {
      console.log(`❌ No se encontró un estudiante con user_id: ${userId}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Estudiante no encontrado' 
      });
    }
    
    const student = studentRows[0];
    console.log(`✅ Estudiante encontrado: ${student.student_name} (Grado: ${student.grade})`);
    
    // 2. Obtener los indicadores asociados al estudiante a través de student_indicators
    const [indicatorRows] = await connection.query(`
      SELECT 
        i.id,
        i.description,
        i.subject,
        i.phase,
        i.created_at,
        i.updated_at,
        si.achieved,
        si.assigned_at,
        t.id as teacher_id,
        u.name as teacher_name,
        t.subject as teacher_subject,
        q.id as questionnaire_id,
        q.title as questionnaire_title,
        q.grade as questionnaire_grade,
        q.phase as questionnaire_phase,
        c.id as course_id,
        c.name as course_name
      FROM student_indicators si
      JOIN indicators i ON si.indicator_id = i.id
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN questionnaires q ON i.questionnaire_id = q.id
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE si.student_id = ?
      ORDER BY i.phase, i.subject, i.created_at DESC
    `, [student.id]);
    
    console.log(`✅ Se encontraron ${indicatorRows.length} indicadores para el estudiante`);
    
    // 3. Formatear la respuesta
    const formattedIndicators = indicatorRows.map(row => ({
      id: row.id,
      description: row.description,
      subject: row.subject,
      phase: row.phase,
      created_at: row.created_at,
      updated_at: row.updated_at,
      achieved: row.achieved === 1, // Convertir a booleano
      assigned_at: row.assigned_at,
      teacher: {
        id: row.teacher_id,
        name: row.teacher_name,
        subject: row.teacher_subject
      },
      questionnaire: row.questionnaire_id ? {
        id: row.questionnaire_id,
        title: row.questionnaire_title,
        grade: row.questionnaire_grade,
        phase: row.questionnaire_phase,
        course: row.course_id ? {
          id: row.course_id,
          name: row.course_name
        } : null
      } : null
    }));
    
    res.json({
      success: true,
      student: {
        id: student.id,
        name: student.student_name,
        grade: student.grade
      },
      count: formattedIndicators.length,
      data: formattedIndicators
    });
    
  } catch (error) {
    console.error('❌ Error al obtener indicadores del estudiante:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener indicadores del estudiante',
      error: error.message 
    });
  } finally {
    connection.release();
  }
});


// Obtener la materia de un profesor por su ID de usuario
router.get('/subjects/teacher/:userId', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { userId } = req.params;
    console.log(`🔍 Obteniendo materia para el profesor con user_id: ${userId}`);
    
    // 1. Obtener la información del profesor
    const [teacherRows] = await connection.query(`
      SELECT 
        t.id,
        t.subject,
        u.name as teacher_name,
        u.email as teacher_email
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.user_id = ?
    `, [userId]);
    
    if (teacherRows.length === 0) {
      console.log(`❌ No se encontró un profesor con user_id: ${userId}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Profesor no encontrado' 
      });
    }
    
    const teacher = teacherRows[0];
    console.log(`✅ Materia del profesor ${teacher.teacher_name}: ${teacher.subject}`);
    
    res.json({
      success: true,
      data: {
        teacher_id: teacher.id,
        subject: teacher.subject,
        teacher_name: teacher.teacher_name,
        teacher_email: teacher.teacher_email
      }
    });
    
  } catch (error) {
    console.error('❌ Error al obtener materia del profesor:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener materia del profesor',
      error: error.message 
    });
  } finally {
    connection.release();
  }
});


export default router;
