// routes/questionnaireRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { 
  verifyToken, 
  isTeacherOrAdmin,
  isAdmin 
} from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware para verificar que el usuario está autenticado
router.use(verifyToken);

/**
 * @route GET /api/questionnaires
 * @description Obtiene la lista de cuestionarios según el rol del usuario
 * @access Privado (docente o super_administrador)
 * @query {string} [phase] - Filtro por fase
 * @query {string} [grade] - Filtro por grado
 * @query {string} [studentId] - Filtro por ID de estudiante
 * @query {string} [description] - Búsqueda por descripción
 */
router.get('/', isTeacherOrAdmin, async (req, res) => {
  console.log('=== INICIO DE SOLICITUD DE CUESTIONARIOS ===');
  console.log('Usuario autenticado:', {
    id: req.user.id,
    role: req.user.role,
    teacher_id: req.user.teacher_id
  });

  try {
    const { phase, grade, studentId, description } = req.query;
    let queryParams = [];
    let conditions = [];
    
    // 1. Construir la consulta base según el rol del usuario
    let query = `
      SELECT DISTINCT q.*, 
        u.name as teacher_name, 
        COUNT(DISTINCT er.student_id) as assigned_students_count
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN evaluation_results er ON q.id = er.questionnaire_id
    `;

    // 2. Aplicar filtros según el rol
    if (req.user.role === 'docente') {
      // Obtener el ID del docente a partir del user_id
      console.log(`🔍 Obteniendo ID de docente para el usuario: ${req.user.id}`);
      const [teacherRows] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      
      if (teacherRows.length === 0) {
        console.error(`❌ No se encontró perfil de docente para el usuario: ${req.user.id}`);
        return res.status(403).json({ 
          success: false, 
          message: 'No se encontró el perfil de docente asociado a tu cuenta',
          error: 'TEACHER_NOT_FOUND'
        });
      }
      
      // Usar solo una condición con el ID del docente
      const teacherId = teacherRows[0].id;
      console.log(`✅ ID de docente obtenido: ${teacherId} para el usuario: ${req.user.id}`);
      
      conditions.push('q.created_by = ?');
      queryParams.push(teacherId);
    }
    // Si es admin, puede ver todos los cuestionarios sin restricciones

    // 3. Aplicar filtros adicionales
    if (phase) {
      conditions.push('q.phase = ?');
      queryParams.push(phase);
    }
    
    if (grade) {
      conditions.push('q.grade = ?');
      queryParams.push(grade);
    }
    
    if (studentId) {
      query += ' INNER JOIN questionnaire_students qs2 ON q.id = qs2.questionnaire_id';
      conditions.push('qs2.student_id = ?');
      queryParams.push(studentId);
    }
    
    if (description) {
      conditions.push('q.description LIKE ?');
      queryParams.push(`%${description}%`);
    }

    // 4. Construir la cláusula WHERE
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // 5. Agrupar por cuestionario
    query += ' GROUP BY q.id';

    // 6. Ordenar por fecha de creación descendente
    query += ' ORDER BY q.created_at DESC';

    console.log('Consulta SQL final:', query);
    console.log('Parámetros:', queryParams);

    // 7. Ejecutar la consulta
    const [questionnaires] = await pool.query(query, queryParams);

    console.log('Cuestionarios encontrados:', questionnaires.length);
    
    // 8. Devolver la respuesta
    res.json({
      success: true,
      data: questionnaires,
      count: questionnaires.length
    });

  } catch (error) {
    console.error('❌ Error al obtener cuestionarios:', error);
    
    // Registrar el error en un sistema de monitoreo si está disponible
    if (process.env.NODE_ENV === 'production') {
      // Aquí podrías integrar con un servicio de monitoreo como Sentry, DataDog, etc.
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener los cuestionarios',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/questionnaires/:id
 * @description Obtiene un cuestionario específico por su ID
 * @access Privado (docente o super_administrador)
 * @param {string} id - ID del cuestionario
 */
router.get('/:id', isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Obtener el cuestionario con información del curso
    const [questionnaires] = await pool.query(
      `SELECT q.*, u.name as teacher_name, c.id as course_id, c.name as course_name, c.grade as course_grade
       FROM questionnaires q
       LEFT JOIN teachers t ON q.created_by = t.id
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN courses c ON q.course_id = c.id
       WHERE q.id = ?`, 
      [id]
    );
    
    if (questionnaires.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cuestionario no encontrado',
        error: 'NOT_FOUND'
      });
    }
    
    const questionnaire = questionnaires[0];
    
    // 2. Verificar permisos (solo el docente creador o admin puede ver)
    if (req.user.role === 'docente') {
      const [teacherRows] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      if (teacherRows.length === 0 || teacherRows[0].id !== questionnaire.created_by) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para ver este cuestionario',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // 3. Obtener las preguntas del cuestionario
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ? ORDER BY id',
      [id]
    );
    
    // 4. Devolver la respuesta
    res.json({
      success: true,
      message: 'Cuestionario obtenido correctamente',
      data: {
        ...questionnaire,
        questions
      }
    });
    
  } catch (error) {
    console.error('❌ Error al obtener el cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el cuestionario',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/questionnaires
 * @description Crea un nuevo cuestionario
 * @access Privado (docente o super_administrador)
 * @body {Object} questionnaire - Datos del cuestionario
 * @body {string} questionnaire.phase - Fase del cuestionario
 * @body {string} questionnaire.grade - Grado al que va dirigido
 * @body {string} questionnaire.description - Descripción del cuestionario
 * @body {Array} questions - Lista de preguntas
 * @body {Array} assigned_students - IDs de estudiantes asignados
 */
router.post('/', isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { phase, grade, description, questions, assigned_students } = req.body;
    
    // 1. Validar datos de entrada
    if (!phase || !grade || !description || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos o la lista de preguntas está vacía',
        error: 'VALIDATION_ERROR'
      });
    }
    
    // 2. Obtener el ID del docente (si es docente)
    let teacherId = null;
    if (req.user.role === 'docente') {
      const [teacherRows] = await connection.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      if (teacherRows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para crear cuestionarios',
          error: 'FORBIDDEN'
        });
      }
      teacherId = teacherRows[0].id;
    } else if (req.body.teacher_id) {
      // Si es admin, puede especificar el docente
      teacherId = req.body.teacher_id;
      
      // Verificar que el docente exista
      const [teacherRows] = await connection.query('SELECT id FROM teachers WHERE id = ?', [teacherId]);
      if (teacherRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El docente especificado no existe',
          error: 'TEACHER_NOT_FOUND'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Se requiere especificar un docente',
        error: 'TEACHER_REQUIRED'
      });
    }
    
    // 3. Insertar el cuestionario
    const [result] = await connection.query(
      'INSERT INTO questionnaires (phase, grade, description, created_by) VALUES (?, ?, ?, ?)',
      [phase, grade, description, teacherId]
    );
    
    const questionnaireId = result.insertId;
    
    // 4. Insertar preguntas
    for (const [index, question] of questions.entries()) {
      const { text, type, options, correct_answer, points } = question;
      
      if (!text || !type) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `La pregunta ${index + 1} no tiene texto o tipo`,
          error: 'VALIDATION_ERROR'
        });
      }
      
      await connection.query(
        'INSERT INTO questions (questionnaire_id, question_text, question_type, question_order, options, correct_answer, points) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          questionnaireId,
          text,
          type,
          index + 1,
          options ? JSON.stringify(options) : null,
          correct_answer || null,
          points || 1
        ]
      );
    }
    
    // 5. Asignar estudiantes si se especificaron
    if (Array.isArray(assigned_students) && assigned_students.length > 0) {
      // Verificar que los estudiantes existan y pertenezcan al docente (si es docente)
      const placeholders = assigned_students.map(() => '?').join(',');
      let studentCheckQuery = `
        SELECT s.id 
        FROM students s
        WHERE s.id IN (${placeholders})
      `;
      
      if (req.user.role === 'docente') {
        studentCheckQuery += ` AND s.teacher_id = ?`;
        const [students] = await connection.query(
          studentCheckQuery,
          [...assigned_students, teacherId]
        );
        
        if (students.length !== assigned_students.length) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Uno o más estudiantes no existen o no tienes permiso para asignarlos',
            error: 'INVALID_STUDENTS'
          });
        }
      } else {
        const [students] = await connection.query(studentCheckQuery, assigned_students);
        if (students.length !== assigned_students.length) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Uno o más estudiantes no existen',
            error: 'INVALID_STUDENTS'
          });
        }
      }
      
      // Asignar estudiantes al cuestionario
      const assignmentValues = assigned_students.map(studentId => [questionnaireId, studentId]);
      await connection.query(
        'INSERT INTO questionnaire_students (questionnaire_id, student_id) VALUES ?',
        [assignmentValues]
      );
    }
    
    // 6. Confirmar la transacción
    await connection.commit();
    
    // 7. Devolver el cuestionario creado
    const [newQuestionnaire] = await connection.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [questionnaireId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Cuestionario creado exitosamente',
      data: newQuestionnaire[0]
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear el cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el cuestionario',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  } finally {
    connection.release();
  }
});

/**
 * @route PUT /api/questionnaires/:id
 * @description Actualiza un cuestionario existente
 * @access Privado (solo el docente creador o admin)
 * @param {string} id - ID del cuestionario a actualizar
 * @body {Object} questionnaire - Datos actualizados del cuestionario
 * @body {string} [questionnaire.phase] - Fase del cuestionario
 * @body {string} [questionnaire.grade] - Grado al que va dirigido
 * @body {string} [questionnaire.description] - Descripción del cuestionario
 * @body {Array} [questions] - Lista actualizada de preguntas
 * @body {Array} [assigned_students] - IDs actualizados de estudiantes asignados
 */
router.put('/:id', isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { phase, grade, description, questions, assigned_students } = req.body;
    
    // 1. Verificar que el cuestionario exista
    const [questionnaires] = await connection.query('SELECT * FROM questionnaires WHERE id = ?', [id]);
    if (questionnaires.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cuestionario no encontrado',
        error: 'NOT_FOUND'
      });
    }
    
    const questionnaire = questionnaires[0];
    
    // 2. Verificar permisos (solo el docente creador o admin puede actualizar)
    if (req.user.role === 'docente') {
      const [teacherRows] = await connection.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      if (teacherRows.length === 0 || teacherRows[0].id !== questionnaire.created_by) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para actualizar este cuestionario',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // 3. Actualizar los campos del cuestionario si se proporcionaron
    const updates = [];
    const updateValues = [];
    
    if (phase !== undefined) {
      updates.push('phase = ?');
      updateValues.push(phase);
    }
    
    if (grade !== undefined) {
      updates.push('grade = ?');
      updateValues.push(grade);
    }
    
    if (description !== undefined) {
      updates.push('description = ?');
      updateValues.push(description);
    }
    
    if (updates.length > 0) {
      updateValues.push(id);
      await connection.query(
        `UPDATE questionnaires SET ${updates.join(', ')} WHERE id = ?`,
        updateValues
      );
    }
    
    // 4. Actualizar preguntas si se proporcionaron
    if (Array.isArray(questions)) {
      // Eliminar preguntas existentes
      await connection.query('DELETE FROM questions WHERE questionnaire_id = ?', [id]);
      
      // Insertar preguntas actualizadas
      for (const [index, question] of questions.entries()) {
        const { text, type, options, correct_answer, points } = question;
        
        if (!text || !type) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `La pregunta ${index + 1} no tiene texto o tipo`,
            error: 'VALIDATION_ERROR'
          });
        }
        
        await connection.query(
          'INSERT INTO questions (questionnaire_id, question_text, question_type, question_order, options, correct_answer, points) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            text,
            type,
            index + 1,
            options ? JSON.stringify(options) : null,
            correct_answer || null,
            points || 1
          ]
        );
      }
    }
    
    // 5. Actualizar estudiantes asignados si se proporcionaron
    if (Array.isArray(assigned_students)) {
      // Eliminar asignaciones existentes
      await connection.query('DELETE FROM questionnaire_students WHERE questionnaire_id = ?', [id]);
      
      // Verificar que los estudiantes existan y pertenezcan al docente (si es docente)
      if (assigned_students.length > 0) {
        const placeholders = assigned_students.map(() => '?').join(',');
        let studentCheckQuery = `
          SELECT s.id 
          FROM students s
          WHERE s.id IN (${placeholders})
        `;
        
        if (req.user.role === 'docente') {
          const [teacherRows] = await connection.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
          const teacherId = teacherRows[0].id;
          
          studentCheckQuery += ` AND s.teacher_id = ?`;
          const [students] = await connection.query(
            studentCheckQuery,
            [...assigned_students, teacherId]
          );
          
          if (students.length !== assigned_students.length) {
            await connection.rollback();
            return res.status(400).json({
              success: false,
              message: 'Uno o más estudiantes no existen o no tienes permiso para asignarlos',
              error: 'INVALID_STUDENTS'
            });
          }
        } else {
          const [students] = await connection.query(studentCheckQuery, assigned_students);
          if (students.length !== assigned_students.length) {
            await connection.rollback();
            return res.status(400).json({
              success: false,
              message: 'Uno o más estudiantes no existen',
              error: 'INVALID_STUDENTS'
            });
          }
        }
        
        // Asignar estudiantes al cuestionario
        const assignmentValues = assigned_students.map(studentId => [id, studentId]);
        await connection.query(
          'INSERT INTO questionnaire_students (questionnaire_id, student_id) VALUES ?',
          [assignmentValues]
        );
      }
    }
    
    // 6. Confirmar la transacción
    await connection.commit();
    
    // 7. Devolver el cuestionario actualizado
    const [updatedQuestionnaire] = await connection.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Cuestionario actualizado exitosamente',
      data: updatedQuestionnaire[0]
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al actualizar el cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el cuestionario',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  } finally {
    connection.release();
  }
});

/**
 * @route DELETE /api/questionnaires/:id
 * @description Elimina un cuestionario existente
 * @access Privado (solo el docente creador o admin)
 * @param {string} id - ID del cuestionario a eliminar
 */
router.delete('/:id', isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    // 1. Verificar que el cuestionario exista
    const [questionnaires] = await connection.query('SELECT * FROM questionnaires WHERE id = ?', [id]);
    if (questionnaires.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cuestionario no encontrado',
        error: 'NOT_FOUND'
      });
    }
    
    const questionnaire = questionnaires[0];
    
    // 2. Verificar permisos (solo el docente creador o admin puede eliminar)
    if (req.user.role === 'docente') {
      const [teacherRows] = await connection.query('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      if (teacherRows.length === 0 || teacherRows[0].id !== questionnaire.created_by) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar este cuestionario',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // 3. Eliminar registros relacionados (esto se manejará con ON DELETE CASCADE en la base de datos)
    // 3.1. Eliminar respuestas de estudiantes (si existen)
    await connection.query('DELETE FROM student_responses WHERE question_id IN (SELECT id FROM questions WHERE questionnaire_id = ?)', [id]);
    
    // 3.2. Eliminar asignaciones de estudiantes
    await connection.query('DELETE FROM questionnaire_students WHERE questionnaire_id = ?', [id]);
    
    // 3.3. Eliminar preguntas
    await connection.query('DELETE FROM questions WHERE questionnaire_id = ?', [id]);
    
    // 4. Eliminar el cuestionario
    await connection.query('DELETE FROM questionnaires WHERE id = ?', [id]);
    
    // 5. Confirmar la transacción
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Cuestionario eliminado exitosamente'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al eliminar el cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el cuestionario',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  } finally {
    connection.release();
  }
});

export default router;
