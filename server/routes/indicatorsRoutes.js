// routes/indicatorRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';

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
        i.category,
        i.phase,
        i.created_at,
        i.teacher_id,
        i.questionnaire_id,
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
      LEFT JOIN questionnaires q ON i.questionnaire_id = q.id
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
    // Iniciar transacción
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { 
      description, 
      subject, 
      phase, 
      achieved = false,
      questionnaire_id = null,
      student_ids = [],
      grade = null,
      teacher_id
    } = req.body;
    
    console.log('🔄 Actualizando indicador ID:', id, {
      description_length: description?.length,
      subject,
      phase,
      achieved,
      questionnaire_id,
      student_count: student_ids?.length || 0,
      grade,
      teacher_id
    });

    // 1. Obtener el questionnaire_id basado en teacher_id (como created_by), phase y grade
    const [questionnaires] = await connection.query(`
      SELECT id 
      FROM questionnaires 
      WHERE created_by = ? AND phase = ? AND grade = ?
      LIMIT 1
    `, [teacher_id, phase, grade]);

    const foundQuestionnaireId = questionnaires[0]?.id || null;
    
    if (!foundQuestionnaireId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se encontró un cuestionario para el grado y fase especificados',
        details: `Buscando cuestionario para teacher_id: ${teacher_id}, phase: ${phase}, grade: ${grade}`
      });
    }

    // 2. Actualizar información básica del indicador
    const [updateResult] = await connection.query(`
      UPDATE indicators 
      SET description = COALESCE(?, description),
          subject = COALESCE(?, subject),
          phase = ?,
          grade = ?
      WHERE id = ? AND teacher_id = ?
    `, [
      description, 
      subject, 
      phase, 
      grade, 
      id,
      teacher_id
    ]);
    
    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Indicador no encontrado o no tienes permiso para editarlo' 
      });
    }
    
    console.log(`✅ Información básica del indicador ${id} actualizada`);
    
    console.log('🔄 Gestionando relaciones con estudiantes para el indicador', id, '...');
    
    // 1. Obtener relaciones existentes para este indicador
    const [currentRelations] = await connection.query(
      'SELECT * FROM student_indicators WHERE indicator_id = ?',
      [id]
    );
    
    console.log('🔍 Relaciones actuales para el indicador', id, ':', currentRelations);
    
    // 2. Si no hay estudiantes seleccionados, no hacemos nada con las relaciones existentes
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      console.log('ℹ️ No hay estudiantes seleccionados. Se mantienen las relaciones existentes.');
      // No hacemos nada con las relaciones existentes
    }
    
    // 3. Inicializar variables para el seguimiento de cambios
    let studentIds = [];
    const currentRelationsMap = new Map();
    let updatedCount = 0;
    let createdCount = 0;
    
    // Procesar student_ids, manejando el caso especial 'all'
    if (Array.isArray(student_ids)) {
      // Si se seleccionó 'all', obtener todos los estudiantes del docente
      if (student_ids.includes('all')) {
        const [allStudents] = await connection.query(
          'SELECT s.id FROM students s JOIN teacher_students ts ON s.id = ts.student_id WHERE ts.teacher_id = ?',
          [teacher_id]
        );
        studentIds = allStudents.map(s => parseInt(s.id));
      } else {
        // Convertir student_ids a números
        studentIds = student_ids.map(id => parseInt(id));
      }
      
      // Crear mapa de relaciones existentes
      currentRelations.forEach(rel => {
        currentRelationsMap.set(parseInt(rel.student_id), rel);
      });
      
      console.log('📌 Estudiantes a procesar:', studentIds);
      console.log('📌 Relaciones existentes:', Array.from(currentRelationsMap.keys()));
    }
    
    // 4. Procesar cada estudiante seleccionado (si hay alguno)
    if (studentIds.length > 0) {
      for (const studentId of studentIds) {
        try {
          // Verificar si ya existe una relación activa para este estudiante e indicador
          const [existingRelation] = await connection.query(
            `SELECT id FROM student_indicators 
             WHERE indicator_id = ? AND student_id = ? 
             ORDER BY assigned_at DESC LIMIT 1`,
            [id, studentId]
          );

          if (existingRelation.length > 0) {
            // Si ya existe una relación, la actualizamos en lugar de crear una nueva
            const [updateResult] = await connection.query(
              `UPDATE student_indicators 
               SET achieved = ?, questionnaire_id = ?, assigned_at = ? 
               WHERE id = ?`,
              [
                achieved ? 1 : 0,
                foundQuestionnaireId,
                new Date(),
                existingRelation[0].id
              ]
            );
            
            if (updateResult.affectedRows > 0) {
              updatedCount++;
              console.log(`🔄 Relación actualizada para estudiante ${studentId} (ID: ${existingRelation[0].id})`);
            }
          } else {
            // Si no existe una relación, creamos una nueva
            // Usamos UPSERT: inserta si no existe, actualiza si ya existe
          await connection.query(
            `INSERT INTO student_indicators 
            (indicator_id, student_id, achieved, questionnaire_id, assigned_at) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              achieved = VALUES(achieved),
              questionnaire_id = VALUES(questionnaire_id),
              assigned_at = VALUES(assigned_at)`,
            [
              id,
              studentId,
              achieved ? 1 : 0,
              foundQuestionnaireId,
              new Date()
            ]
          );
          createdCount++;
          console.log(`✅ Relación creada/actualizada para estudiante ${studentId}`);
          }
        } catch (error) {
          console.error(`❌ Error al procesar relación para estudiante ${studentId}:`, error);
          // Continuar con los siguientes estudiantes en caso de error
          continue;
        }
      }
      
      // 5. No eliminamos relaciones existentes, solo actualizamos o creamos nuevas
      // Esto evita la pérdida de datos históricos
      console.log('ℹ️ Se mantienen todas las relaciones existentes. Solo se actualizan o crean nuevas.');
    
      console.log('📊 Resumen de cambios:', {
        indicador_id: id,
        relaciones_actualizadas: updatedCount,
        nuevas_relaciones_creadas: createdCount,
        cuestionario_asociado: foundQuestionnaireId || 'Ninguno',
        total_estudiantes_asignados: updatedCount + createdCount
      });
    }
    // 5. Obtener el cuestionario más reciente para este docente, fase y grado
    const [questionnaireResult] = await connection.query(
      'SELECT id, title FROM questionnaires WHERE created_by = ? AND phase = ? AND grade = ? ORDER BY created_at DESC LIMIT 1',
      [teacher_id, phase, grade]
    );
    
    const currentQuestionnaire = questionnaireResult.length > 0 ? questionnaireResult[0] : null;
    const questionnaireId = currentQuestionnaire ? currentQuestionnaire.id : null;

    // 6. Obtener el indicador con sus relaciones
    // Primero obtenemos los datos básicos del indicador
    const [indicators] = await connection.query(
      'SELECT * FROM indicators WHERE id = ?',
      [id]
    );

    if (indicators.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Indicador no encontrado'
      });
    }

    // Luego obtenemos las asignaciones de estudiantes
    const [studentAssignments] = await connection.query(
      `SELECT 
        si.student_id,
        si.achieved,
        si.questionnaire_id,
        DATE_FORMAT(si.assigned_at, '%Y-%m-%d %H:%i:%s') as assigned_at
      FROM student_indicators si
      WHERE si.indicator_id = ?
      ORDER BY si.assigned_at DESC`,
      [id]
    );

    // Construir el objeto de respuesta
    const indicatorData = {
      ...indicators[0],
      student_assignments: studentAssignments,
      current_questionnaire_id: questionnaireId,
      current_questionnaire_title: currentQuestionnaire ? currentQuestionnaire.title : null,
      total_assignments: studentAssignments.length
    };
    
    // Reemplazar el array indicators con nuestro objeto construido
    indicators[0] = indicatorData;
    
    if (indicators.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'No se pudo recuperar el indicador actualizado'
      });
    }
    
    // Obtener información de los estudiantes asignados para la respuesta
    let studentInfo = [];
    if (studentIds && studentIds.length > 0) {
      const [studentInfoResult] = await connection.query(
        `SELECT s.id, u.name 
         FROM students s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.id IN (?)`,
        [studentIds]
      );
      studentInfo = studentInfoResult;
    }
    
    // Construir respuesta detallada
    const responseData = {
      ...indicatorData,
      student_info: studentInfo,
      updated_at: new Date().toISOString()
    };

    // Confirmar la transacción
    await connection.commit();
    
    // Construir respuesta
    const response = {
      success: true,
      message: 'Indicador actualizado correctamente',
      data: responseData
    };
    
    // Si hay un token en el request, incluirlo en la respuesta
    if (req.token) {
      response.token = req.token;
    }
    
    // Asegurarse de que la conexión se libere
    connection.release();
    
    // Enviar respuesta
    return res.status(200).json(response);

  } catch (error) {
    // Hacer rollback en caso de error
    if (connection) {
      try {
        await connection.rollback();
        console.log('🔙 Rollback de la transacción realizado');
      } catch (rollbackError) {
        console.error('❌ Error al hacer rollback:', rollbackError);
      }
    }
    
    console.error('❌ Error al actualizar indicador:', {
      message: error.message,
      stack: error.stack,
      request: {
        params: req.params,
        body: req.body,
        user: req.user
      }
    });
    
    // Si el error es de autenticación, devolver 401
    if (error.message.includes('No autorizado') || error.message.includes('token') || error.message.includes('autenticación')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token no válido o expirado. Por favor, inicie sesión nuevamente.',
        requiresLogin: true
      });
    }
    
    // Para otros errores, devolver 500
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar el indicador',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Liberar la conexión en cualquier caso
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('❌ Error al liberar la conexión:', releaseError);
      }
    }
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


// Obtener estudiantes con su estado de indicador
router.get('/:id/students', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id: indicatorId } = req.params;
    const userId = req.user.id; // ID del usuario autenticado

    console.log(`🔍 Obteniendo estudiantes para el indicador ${indicatorId}`);

    // 1. Obtener el ID del profesor
    const [teacher] = await connection.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [userId]
    );

    if (teacher.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: no eres un profesor'
      });
    }

    const teacherId = teacher[0].id;

    // 2. Verificar que el indicador pertenece al profesor
    const [indicator] = await connection.query(
      'SELECT id, teacher_id FROM indicators WHERE id = ?',
      [indicatorId]
    );

    if (indicator.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Indicador no encontrado'
      });
    }

    if (indicator[0].teacher_id !== teacherId && req.user.role !== 'super_administrador') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este indicador'
      });
    }

    // 3. Obtener estudiantes con información detallada del indicador
    console.log('🔍 Obteniendo estudiantes para el indicador:', indicatorId);
    console.log('👨‍🏫 ID del profesor:', teacherId);
    
    const [students] = await connection.query(`
      SELECT 
        s.id,
        s.user_id,
        u.name as name,
        s.grade,
        u.email,
        si.achieved,
        si.assigned_at,
        si.indicator_id,
        si.assigned_at as indicator_created_at,
        CASE WHEN si.id IS NOT NULL THEN 1 ELSE 0 END as has_indicator
      FROM students s
      INNER JOIN users u ON s.user_id = u.id
      INNER JOIN teacher_students ts ON s.id = ts.student_id
      LEFT JOIN (
        SELECT si.* 
        FROM student_indicators si
        INNER JOIN indicators i ON si.indicator_id = i.id
        WHERE si.indicator_id = ? AND i.teacher_id = ?
      ) si ON s.id = si.student_id
      WHERE ts.teacher_id = ? 
        AND u.estado = 'activo'
      ORDER BY u.name
    `, [indicatorId, teacherId, teacherId]);
    
    console.log('📊 Estudiantes encontrados:', students.length);
    if (students.length > 0) {
      console.log('📝 Primer estudiante:', {
        id: students[0].id,
        name: students[0].name,
        has_indicator: students[0].has_indicator,
        indicator_id: students[0].indicator_id,
        achieved: students[0].achieved
      });
    }
    
    console.log('📊 Estudiantes con estado de indicador:', JSON.stringify(students, null, 2));

    console.log(`✅ Se encontraron ${students.length} estudiantes`);

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    console.error('❌ Error al obtener estudiantes con indicador:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al cargar los estudiantes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

// Ruta para eliminar un indicador de un estudiante
// Ruta para eliminar un indicador de un estudiante (versión mejorada)
router.delete('/:indicatorId/students/:studentId', 
  verifyToken,
  isTeacherOrAdmin,
  async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const { indicatorId, studentId } = req.params;
      const userId = req.user.id; // Este es el ID del usuario autenticado (users.id)

      console.log(`🗑️  Solicitada eliminación de relación: estudiante ${studentId} del indicador ${indicatorId} por usuario ${userId}`);

      // 1. Obtener el ID del profesor a partir del user_id
      const [teacher] = await connection.query(
        'SELECT id, user_id FROM teachers WHERE user_id = ?',
        [userId]
      );

      if (teacher.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no tienes permisos de profesor'
        });
      }

      const teacherId = teacher[0].id; // Este es el ID del profesor en la tabla teachers

      // 2. Verificar que el indicador pertenece al docente
      const [indicator] = await connection.query(
        'SELECT i.id, i.teacher_id, i.description FROM indicators i WHERE i.id = ? AND i.teacher_id = ?',
        [indicatorId, teacherId]
      );

      if (indicator.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Indicador no encontrado o no autorizado'
        });
      }

      // 3. Verificar que el estudiante existe y pertenece al docente
      const [student] = await connection.query(
        `SELECT s.id, u.name 
         FROM students s 
         JOIN users u ON s.user_id = u.id 
         JOIN teacher_students ts ON s.id = ts.student_id 
         WHERE s.id = ? AND ts.teacher_id = ?`,
        [studentId, teacherId]
      );

      if (student.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Estudiante no encontrado o no tienes permisos para acceder a él'
        });
      }

      // 3. Verificar que existe la relación
      const [relation] = await connection.query(
        'SELECT id FROM student_indicators WHERE indicator_id = ? AND student_id = ?',
        [indicatorId, studentId]
      );

      if (relation.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'La relación estudiante-indicador no existe'
        });
      }

      // 4. Eliminar la relación
      await connection.query(
        'DELETE FROM student_indicators WHERE indicator_id = ? AND student_id = ?',
        [indicatorId, studentId]
      );
      
      // 5. Registrar la acción en el log de auditoría (si la tabla existe)
      try {
        await connection.query(
          `INSERT INTO audit_logs 
           (action, description, user_id, table_name, record_id, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            'DELETE_INDICATOR_ASSIGNMENT',
            `Se eliminó el indicador (ID: ${indicatorId}) del estudiante ${student[0].name} (ID: ${student[0].id})`,
            teacherId, // user_id del usuario autenticado
            'student_indicators',
            relation[0].id // ID de la relación eliminada
          ]
        );
        console.log('✅ Acción registrada en el log de auditoría');
      } catch (auditError) {
        // Si hay un error al registrar en el log, solo lo mostramos en consola
        // pero no detenemos el flujo ya que la eliminación ya se realizó
        console.warn('⚠️ No se pudo registrar en el log de auditoría. Continuando con la operación...', auditError.message);
      }
      
      await connection.commit();
      
      console.log('✅ Relación eliminada correctamente');
      
      res.json({ 
        success: true,
        message: 'Indicador eliminado correctamente del estudiante',
        data: {
          studentId: student[0].id,
          studentName: student[0].name,
          indicatorId: indicator[0].id,
          indicatorName: indicator[0].description.substring(0, 50) + '...',
          relationId: relation[0].id
        }
      });
      
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      
      console.error('❌ Error al eliminar relación estudiante-indicador:', error);
      
      res.status(500).json({ 
        success: false,
        message: 'Error al eliminar la asignación del indicador',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

export default router;
