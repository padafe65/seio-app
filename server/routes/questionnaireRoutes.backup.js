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
        u.last_name as teacher_last_name,
        COUNT(DISTINCT qs.student_id) as assigned_students_count
      FROM questionnaires q
      LEFT JOIN teachers t ON q.created_by = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN questionnaire_students qs ON q.id = qs.questionnaire_id
    `;
    
    // 2. Si es docente, solo puede ver sus propios cuestionarios
    if (req.user.role === 'docente') {
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0) {
        console.log('Usuario no tiene perfil de profesor:', req.user.id);
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este recurso',
          error: 'FORBIDDEN'
        });
      }
      
      conditions.push('q.created_by = ?');
      queryParams.push(teacherRows[0].id);
    }
    
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
      conditions.push('qs.student_id = ?');
      queryParams.push(studentId);
    }
    
    if (description) {
      conditions.push('(q.title LIKE ? OR q.description LIKE ?)');
      queryParams.push(`%${description}%`, `%${description}%`);
    }
    
    // 4. Construir la cláusula WHERE si hay condiciones
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // 5. Agrupar por cuestionario
    query += ' GROUP BY q.id';
    
    // 6. Ordenar por fecha de creación descendente
    query += ' ORDER BY q.created_at DESC';
    
    console.log('Consulta SQL:', query);
    console.log('Parámetros:', queryParams);
    
    // 7. Ejecutar la consulta
    const [questionnaires] = await pool.query(query, queryParams);
    
    console.log('Cuestionarios encontrados:', questionnaires.length);
    
    res.json({ 
      success: true, 
      data: questionnaires 
    });
    
  } catch (error) {
    console.error('❌ Error al obtener los cuestionarios:', error);
    
    // Registrar el error en un sistema de monitoreo si está disponible
    if (process.env.NODE_ENV === 'production') {
      // Aquí podrías agregar código para enviar el error a un servicio como Sentry
      console.error('Error en producción:', error);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener los cuestionarios',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
    });
  }
});

/**
 * @route GET /api/questionnaires/:id
 * @description Obtiene un cuestionario específico por ID con sus preguntas
 * @access Privado (docente o super_administrador)
 */
router.get('/:id', isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Obtener el cuestionario
    const [questionnaires] = await pool.query(
      `SELECT q.*, u.name as teacher_name, u.last_name as teacher_last_name
       FROM questionnaires q
       LEFT JOIN teachers t ON q.created_by = t.id
       LEFT JOIN users u ON t.user_id = u.id
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
    
    // 2. Verificar permisos si el usuario es docente
    if (req.user.role === 'docente') {
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0 || teacherRows[0].id !== questionnaire.created_by) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este recurso',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // 3. Obtener las preguntas del cuestionario
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ? ORDER BY question_order ASC',
      [id]
    );
    
    // 4. Obtener estudiantes asignados al cuestionario
    const [assignedStudents] = await pool.query(
      `SELECT s.id, u.name, u.last_name, u.email 
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN questionnaire_students qs ON s.id = qs.student_id
       WHERE qs.questionnaire_id = ?`,
      [id]
    );
    
    // 5. Devolver el cuestionario con sus preguntas y estudiantes asignados
    res.json({ 
      success: true, 
      data: {
        ...questionnaire,
        questions,
        assigned_students: assignedStudents
      }
    });
    
  } catch (error) {
    console.error('❌ Error al obtener el cuestionario:', error);
    
    // Registrar el error en un sistema de monitoreo si está disponible
    if (process.env.NODE_ENV === 'production') {
      console.error('Error en producción:', error);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener el cuestionario',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
    });
  }
});

/**
 * @route POST /api/questionnaires
 * @description Crea un nuevo cuestionario con sus preguntas
 * @access Privado (solo docentes)
 */
router.post('/', isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { title, description, phase, grade, questions, studentIds } = req.body;
    
    // 1. Verificar que el usuario sea docente
    let teacherId;
    
    if (req.user.role === 'docente') {
      const [teacherRows] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Solo los docentes pueden crear cuestionarios',
          error: 'FORBIDDEN'
        });
      }
      
      teacherId = teacherRows[0].id;
    } else {
      // Si es administrador, verificar que se proporcione el ID del docente
      if (!req.body.teacher_id) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID del docente',
          error: 'BAD_REQUEST'
        });
      }
      teacherId = req.body.teacher_id;
    }
    
    // 2. Validar datos de entrada
    if (!title || !phase || !grade) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos',
        error: 'BAD_REQUEST'
      });
    }
    
    // 3. Insertar el cuestionario
    const [result] = await connection.query(
      `INSERT INTO questionnaires 
       (title, description, phase, grade, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [title, description || null, phase, grade, teacherId]
    );
    
    const questionnaireId = result.insertId;
    
    // 4. Insertar las preguntas si existen
    if (questions && questions.length > 0) {
      const questionValues = questions.map((q, index) => [
        questionnaireId,
        q.question_text,
        q.question_type,
        JSON.stringify(q.options || []),
        q.correct_answer || null,
        index + 1
      ]);
      
      await connection.query(
        `INSERT INTO questions 
         (questionnaire_id, question_text, question_type, options, correct_answer, question_order) 
         VALUES ?`,
        [questionValues]
      );
    }
    
    // 5. Asignar estudiantes al cuestionario si se proporcionan
    if (studentIds && studentIds.length > 0) {
      const studentValues = studentIds.map(studentId => [questionnaireId, studentId]);
      
      await connection.query(
        'INSERT INTO questionnaire_students (questionnaire_id, student_id) VALUES ?',
        [studentValues]
      );
    }
    
    await connection.commit();
    
    // 6. Obtener el cuestionario creado con sus preguntas y estudiantes
    const [newQuestionnaire] = await pool.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [questionnaireId]
    );
    
    const [questionnaireQuestions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ? ORDER BY question_order ASC',
      [questionnaireId]
    );
    
    const [assignedStudents] = await pool.query(
      `SELECT s.id, u.name, u.last_name, u.email 
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN questionnaire_students qs ON s.id = qs.student_id
       WHERE qs.questionnaire_id = ?`,
      [questionnaireId]
    );
    
    res.status(201).json({
      success: true,
      data: {
        ...newQuestionnaire[0],
        questions: questionnaireQuestions,
        assigned_students: assignedStudents
      },
      message: 'Cuestionario creado exitosamente'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear el cuestionario:', error);
    
    // Registrar el error en un sistema de monitoreo si está disponible
    if (process.env.NODE_ENV === 'production') {
      console.error('Error en producción:', error);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al crear el cuestionario',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
    });
  } finally {
    connection.release();
  }
});

/**
 * @route PUT /api/questionnaires/:id
 * @description Actualiza un cuestionario existente
 * @access Privado (solo el docente creador o admin)
 */
router.put('/:id', isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { title, description, phase, grade, questions, studentIds } = req.body;
    
    // 1. Obtener el cuestionario existente
    const [questionnaires] = await connection.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [id]
    );
    
    if (questionnaires.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cuestionario no encontrado',
        error: 'NOT_FOUND'
      });
    }
    
    const existingQuestionnaire = questionnaires[0];
    
    // 2. Verificar permisos
    if (req.user.role === 'docente') {
      const [teacherRows] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0 || teacherRows[0].id !== existingQuestionnaire.created_by) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este cuestionario',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // 3. Validar datos de entrada
    if (!title || !phase || !grade) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos',
        error: 'BAD_REQUEST'
      });
    }
    
    // 4. Actualizar el cuestionario
    await connection.query(
      `UPDATE questionnaires 
       SET title = ?, description = ?, phase = ?, grade = ?, updated_at = NOW() 
       WHERE id = ?`,
      [title, description || null, phase, grade, id]
    );
    
    // 5. Eliminar las preguntas existentes
    await connection.query(
      'DELETE FROM questions WHERE questionnaire_id = ?',
      [id]
    );
    
    // 6. Insertar las nuevas preguntas si existen
    if (questions && questions.length > 0) {
      const questionValues = questions.map((q, index) => [
        id,
        q.question_text,
        q.question_type,
        JSON.stringify(q.options || []),
        q.correct_answer || null,
        index + 1
      ]);
      
      await connection.query(
        `INSERT INTO questions 
         (questionnaire_id, question_text, question_type, options, correct_answer, question_order) 
         VALUES ?`,
        [questionValues]
      );
    }
    
    // 7. Actualizar estudiantes asignados si se proporcionan
    if (studentIds) {
      // Eliminar asignaciones existentes
      await connection.query(
        'DELETE FROM questionnaire_students WHERE questionnaire_id = ?',
        [id]
      );
      
      // Insertar nuevas asignaciones si hay estudiantes
      if (studentIds.length > 0) {
        const studentValues = studentIds.map(studentId => [id, studentId]);
        
        await connection.query(
          'INSERT INTO questionnaire_students (questionnaire_id, student_id) VALUES ?',
          [studentValues]
        );
      }
    }
    
    await connection.commit();
    
    // 8. Obtener el cuestionario actualizado con sus preguntas y estudiantes
    const [updatedQuestionnaire] = await pool.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [id]
    );
    
    const [questionnaireQuestions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ? ORDER BY question_order ASC',
      [id]
    );
    
    const [assignedStudents] = await pool.query(
      `SELECT s.id, u.name, u.last_name, u.email 
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN questionnaire_students qs ON s.id = qs.student_id
       WHERE qs.questionnaire_id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      data: {
        ...updatedQuestionnaire[0],
        questions: questionnaireQuestions,
        assigned_students: assignedStudents
      },
      message: 'Cuestionario actualizado exitosamente'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al actualizar el cuestionario:', error);
    
    // Registrar el error en un sistema de monitoreo si está disponible
    if (process.env.NODE_ENV === 'production') {
      console.error('Error en producción:', error);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el cuestionario',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
    });
  } finally {
    connection.release();
  }
});

/**
 * @route DELETE /api/questionnaires/:id
 * @description Elimina un cuestionario y sus preguntas
 * @access Privado (solo el docente creador o admin)
 */
router.delete('/:id', isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    // 1. Obtener el cuestionario existente
    const [questionnaires] = await connection.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [id]
    );
    
    if (questionnaires.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cuestionario no encontrado',
        error: 'NOT_FOUND'
      });
    }
    
    const existingQuestionnaire = questionnaires[0];
    
    // 2. Verificar permisos
    if (req.user.role === 'docente') {
      const [teacherRows] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0 || teacherRows[0].id !== existingQuestionnaire.created_by) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar este cuestionario',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // 3. Eliminar las respuestas de los estudiantes primero
    await connection.query(
      'DELETE FROM student_answers WHERE question_id IN (SELECT id FROM questions WHERE questionnaire_id = ?)',
      [id]
    );
    
    // 4. Eliminar las asignaciones de estudiantes al cuestionario
    await connection.query(
      'DELETE FROM questionnaire_students WHERE questionnaire_id = ?',
      [id]
    );
    
    // 5. Eliminar las preguntas del cuestionario
    await connection.query(
      'DELETE FROM questions WHERE questionnaire_id = ?',
      [id]
    );
    
    // 6. Finalmente, eliminar el cuestionario
    await connection.query(
      'DELETE FROM questionnaires WHERE id = ?',
      [id]
    );
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Cuestionario eliminado exitosamente'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al eliminar el cuestionario:', error);
    
    // Registrar el error en un sistema de monitoreo si está disponible
    if (process.env.NODE_ENV === 'production') {
      console.error('Error en producción:', error);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el cuestionario',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
    });
  } finally {
    connection.release();
  }
});

export default router;
    }
    
    // 2. Construir la consulta SQL según el rol del usuario
    let query = `
      SELECT q.*, u.name as teacher_name, u.last_name as teacher_last_name
      FROM questionnaires q
      LEFT JOIN teachers t ON q.created_by = t.id
      LEFT JOIN users u ON t.user_id = u.id
    `;
    
    const queryParams = [];
    
    // Si es docente, solo puede ver sus propios cuestionarios
    if (req.user.role === 'docente') {
      query += ' WHERE q.created_by = ?';
      queryParams.push(teacherId);
    }
    
    // Aplicar filtros adicionales si existen
    if (req.query.phase) {
      query += req.user.role === 'docente' ? ' AND' : ' WHERE';
      query += ' q.phase = ?';
      queryParams.push(req.query.phase);
    }
    
    if (req.query.grade) {
      query += (req.user.role === 'docente' || req.query.phase) ? ' AND' : ' WHERE';
      query += ' q.grade = ?';
      queryParams.push(req.query.grade);
    }
    
    // Ordenar por fecha de creación descendente
    query += ' ORDER BY q.created_at DESC';
    
    console.log('Consulta SQL:', query);
    console.log('Parámetros:', queryParams);
    
    // 3. Ejecutar la consulta
    const [questionnaires] = await pool.query(query, queryParams);
    
    console.log('Cuestionarios encontrados:', questionnaires.length);
    
    res.json({ 
      success: true, 
      data: questionnaires 
    });
    
  } catch (error) {
    console.error('❌ Error al obtener los cuestionarios:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener los cuestionarios',
      error: error.message 
    });
  }
});

/**
 * @route GET /api/questionnaires/:id
 * @description Obtiene un cuestionario específico por ID con sus preguntas
 * @access Privado (docente o super_administrador)
 */
router.get('/:id', isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Obtener el cuestionario
    const [questionnaires] = await pool.query(
      `SELECT q.*, u.name as teacher_name, u.last_name as teacher_last_name
       FROM questionnaires q
       LEFT JOIN teachers t ON q.created_by = t.id
       LEFT JOIN users u ON t.user_id = u.id
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
    
    // 2. Verificar permisos si el usuario es docente
    if (req.user.role === 'docente') {
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0 || teacherRows[0].id !== questionnaire.created_by) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este recurso',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // 3. Obtener las preguntas del cuestionario
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ? ORDER BY question_order ASC',
      [id]
    );
    
    // 4. Devolver el cuestionario con sus preguntas
    res.json({ 
      success: true, 
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
      error: error.message 
    });
  }
});

/**
 * @route POST /api/questionnaires
 * @description Crea un nuevo cuestionario con sus preguntas
 * @access Privado (solo docentes)
 */
router.post('/', isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { title, description, phase, grade, questions } = req.body;
    
    // 1. Verificar que el usuario sea docente
    let teacherId;
    
    if (req.user.role === 'docente') {
      const [teacherRows] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Solo los docentes pueden crear cuestionarios',
          error: 'FORBIDDEN'
        });
      }
      
      teacherId = teacherRows[0].id;
    } else {
      // Si es administrador, verificar que se proporcione el ID del docente
      if (!req.body.teacher_id) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID del docente',
          error: 'BAD_REQUEST'
        });
      }
      teacherId = req.body.teacher_id;
    }
    
    // 2. Insertar el cuestionario
    const [result] = await connection.query(
      `INSERT INTO questionnaires 
       (title, description, phase, grade, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [title, description, phase, grade, teacherId]
    );
    
    const questionnaireId = result.insertId;
    
    // 3. Insertar las preguntas
    if (questions && questions.length > 0) {
      const questionValues = questions.map((q, index) => [
        questionnaireId,
        q.question_text,
        q.question_type,
        JSON.stringify(q.options || []),
        q.correct_answer || null,
        index + 1
      ]);
      
      await connection.query(
        `INSERT INTO questions 
         (questionnaire_id, question_text, question_type, options, correct_answer, question_order) 
         VALUES ?`,
        [questionValues]
      );
    }
    
    await connection.commit();
    
    // 4. Obtener el cuestionario creado con sus preguntas
    const [newQuestionnaire] = await pool.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [questionnaireId]
    );
    
    const [questionnaireQuestions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ? ORDER BY question_order ASC',
      [questionnaireId]
    );
    
    res.status(201).json({
      success: true,
      data: {
        ...newQuestionnaire[0],
        questions: questionnaireQuestions
      },
      message: 'Cuestionario creado exitosamente'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear el cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el cuestionario',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * @route PUT /api/questionnaires/:id
 * @description Actualiza un cuestionario existente
 * @access Privado (solo el docente creador o admin)
 */
router.put('/:id', isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { title, description, phase, grade, questions } = req.body;
    
    // 1. Obtener el cuestionario existente
    const [questionnaires] = await connection.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [id]
    );
    
    if (questionnaires.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cuestionario no encontrado',
        error: 'NOT_FOUND'
      });
    }
    
    const existingQuestionnaire = questionnaires[0];
    
    // 2. Verificar permisos
    if (req.user.role === 'docente') {
      const [teacherRows] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0 || teacherRows[0].id !== existingQuestionnaire.created_by) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este cuestionario',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // 3. Actualizar el cuestionario
    await connection.query(
      `UPDATE questionnaires 
       SET title = ?, description = ?, phase = ?, grade = ?, updated_at = NOW() 
       WHERE id = ?`,
      [title, description, phase, grade, id]
    );
    
    // 4. Eliminar las preguntas existentes y agregar las nuevas
    await connection.query(
      'DELETE FROM questions WHERE questionnaire_id = ?',
      [id]
    );
    
    // 5. Insertar las nuevas preguntas
    if (questions && questions.length > 0) {
      const questionValues = questions.map((q, index) => [
        id,
        q.question_text,
        q.question_type,
        JSON.stringify(q.options || []),
        q.correct_answer || null,
        index + 1
      ]);
      
      await connection.query(
        `INSERT INTO questions 
         (questionnaire_id, question_text, question_type, options, correct_answer, question_order) 
         VALUES ?`,
        [questionValues]
      );
    }
    
    await connection.commit();
    
    // 6. Obtener el cuestionario actualizado con sus preguntas
    const [updatedQuestionnaire] = await pool.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [id]
    );
    
    const [questionnaireQuestions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ? ORDER BY question_order ASC',
      [id]
    );
    
    res.json({
      success: true,
      data: {
        ...updatedQuestionnaire[0],
        questions: questionnaireQuestions
      },
      message: 'Cuestionario actualizado exitosamente'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al actualizar el cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el cuestionario',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * @route DELETE /api/questionnaires/:id
 * @description Elimina un cuestionario y sus preguntas
 * @access Privado (solo el docente creador o admin)
 */
router.delete('/:id', isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    // 1. Obtener el cuestionario existente
    const [questionnaires] = await connection.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [id]
    );
    
    if (questionnaires.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cuestionario no encontrado',
        error: 'NOT_FOUND'
      });
    }
    
    const existingQuestionnaire = questionnaires[0];
    
    // 2. Verificar permisos
    if (req.user.role === 'docente') {
      const [teacherRows] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0 || teacherRows[0].id !== existingQuestionnaire.created_by) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar este cuestionario',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // 3. Eliminar las preguntas del cuestionario
    await connection.query(
      'DELETE FROM questions WHERE questionnaire_id = ?',
      [id]
    );
    
    // 4. Eliminar el cuestionario
    await connection.query(
      'DELETE FROM questionnaires WHERE id = ?',
      [id]
    );
    
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
      error: error.message
    });
  } finally {
    connection.release();
  }
});

export default router;
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
 */
router.get('/', isTeacherOrAdmin, async (req, res) => {
  console.log('=== INICIO DE SOLICITUD DE CUESTIONARIOS ===');
  console.log('Usuario autenticado:', {
    id: req.user.id,
    role: req.user.role,
    teacher_id: req.user.teacher_id
  });

  try {
    // 1. Obtener el ID del docente si el usuario es docente
    let teacherId = null;
    
    if (req.user.role === 'docente') {
      // Primero obtenemos el teacher_id del usuario autenticado
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0) {
        console.log('Usuario no tiene perfil de profesor:', req.user.id);
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este recurso',
          error: 'FORBIDDEN'
        });
      }
      
      teacherId = teacherRows[0].id;
      console.log('ID del docente encontrado:', teacherId);
    }
    
    // 2. Construir la consulta base con JOINs necesarios
    let query = `
      SELECT 
        q.*, 
        u.name as teacher_name,
        u.email as teacher_email,
        c.name as course_name,
        (SELECT COUNT(*) FROM questions WHERE questionnaire_id = q.id) as question_count
      FROM questionnaires q
      INNER JOIN teachers t ON q.created_by = t.id
      INNER JOIN users u ON t.user_id = u.id
      LEFT JOIN courses c ON q.course_id = c.id
    `;
    
    const params = [];
    const conditions = [];
    
    // 3. Aplicar filtros según el rol del usuario
    if (req.user.role === 'docente') {
      // Los docentes solo pueden ver sus propios cuestionarios
      conditions.push('q.created_by = ?');
      params.push(teacherId);
    } else if (req.user.role === 'super_administrador') {
      // Los administradores pueden ver todos los cuestionarios
      // No se aplican restricciones adicionales
    } else {
      // Cualquier otro rol no tiene acceso
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a este recurso',
        error: 'FORBIDDEN'
      });
    }
    
    // 4. Aplicar filtros adicionales de búsqueda
    if (req.query.phase && req.query.phase !== 'all') {
      conditions.push('q.phase = ?');
      params.push(req.query.phase);
    }
    
    if (req.query.grade && req.query.grade !== 'all') {
      conditions.push('q.grade = ?');
      params.push(req.query.grade);
    }
    
    // Filtrar por búsqueda en título o descripción
    if (req.query.search) {
      conditions.push('(q.title LIKE ? OR q.description LIKE ?)');
      const searchTerm = `%${req.query.search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    // 5. Aplicar condiciones WHERE
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // 6. Ordenar por fecha de creación descendente
    query += ' ORDER BY q.created_at DESC';
    
    // 7. Ejecutar la consulta
    console.log('\n=== CONSULTA SQL ===');
    console.log('SQL:', query);
    console.log('Parámetros:', params);
    
    const [rows] = await pool.query(query, params);
    
    console.log('\n=== RESULTADOS ===');
    console.log('Número de filas:', rows.length);
    
    // 8. Formatear la respuesta
    const formattedRows = rows.map(q => ({
      id: q.id,
      title: q.title,
      category: q.category,
      grade: q.grade,
      phase: q.phase,
      created_at: q.created_at,
      updated_at: q.updated_at,
      course_id: q.course_id,
      created_by: q.created_by,
      description: q.description,
      teacher_name: q.teacher_name,
      teacher_email: q.teacher_email,
      course_name: q.course_name || null,
      subject_name: q.category ? q.category.split('_')[1] || '' : '',
      metadata: {
        question_count: q.question_count || 0
      }
    }));
    
    // 9. Enviar respuesta exitosa
    res.json({
      success: true,
      count: formattedRows.length,
      data: formattedRows,
      pagination: {
        total: formattedRows.length,
        page: parseInt(req.query.page) || 1,
        pageSize: parseInt(req.query.pageSize) || formattedRows.length,
        pageCount: 1 // Se puede implementar paginación si es necesario
      }
    });
    
  } catch (error) {
    console.error('❌ Error al obtener cuestionarios:', error);
    
    // Registrar el error en un sistema de monitoreo si está disponible
    if (process.env.NODE_ENV === 'production') {
      // Aquí podrías enviar el error a un servicio como Sentry, LogRocket, etc.
      console.error('Error detallado:', {
        message: error.message,
        stack: error.stack,
        user: req.user ? { id: req.user.id, role: req.user.role } : 'No autenticado',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener los cuestionarios. Por favor, inténtalo de nuevo más tarde.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Ruta para obtener un cuestionario por ID
router.get('/:id', isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        message: 'Se requiere el ID del cuestionario',
        error: 'BAD_REQUEST'
      });
    }

    // Consulta para obtener el cuestionario con información del creador
    const query = `
      SELECT 
        q.*, 
        u.name as teacher_name, 
    
    if (questionnaires.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cuestionario no encontrado',
        error: 'NOT_FOUND'
      });
    }
    
    const questionnaire = questionnaires[0];
    
    // Verificar permisos si es docente
    if (req.user.role === 'docente') {
      // Verificar que el cuestionario pertenece al docente
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0 || teacherRows[0].id !== questionnaire.created_by) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este recurso',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // Obtener las preguntas del cuestionario
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ?',
      [id]
    );
    
    res.json({
      success: true,
      questionnaire,
      questions
    });
    
  } catch (error) {
    console.error('❌ Error al obtener el cuestionario:', error);
    
    if (process.env.NODE_ENV === 'production') {
      // Registrar el error en un sistema de monitoreo
      console.error('Error en producción:', error);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener el cuestionario',
      error: process.env.NODE_ENV === 'development' ? error.message : 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Ruta para crear un nuevo cuestionario
router.post('/', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { title, description, course_id, phase, grade, category } = req.body;
    
    // Validar campos requeridos
    if (!title || !course_id) {
      return res.status(400).json({
        message: 'El título y el curso son campos requeridos',
        error: 'VALIDATION_ERROR',
        fields: {
          title: !title ? 'El título es requerido' : undefined,
          course_id: !course_id ? 'El curso es requerido' : undefined
        }
      });
    }
    
    // Verificar que el usuario sea docente
    if (req.user.role !== 'docente' || !req.user.teacher_id) {
      return res.status(403).json({
        message: 'Solo los docentes pueden crear cuestionarios',
        error: 'FORBIDDEN'
      });
    }
    
    // Insertar el nuevo cuestionario
    const [result] = await pool.query(
      `INSERT INTO questionnaires 
       (title, description, course_id, created_by, phase, grade, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        course_id,
        req.user.teacher_id, // Usar el ID del docente del token
        phase || 'borrador',
        grade || null,
        category || null
      ]
    );
    
    // Obtener el cuestionario recién creado
    const [newQuestionnaire] = await pool.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [result.insertId]
    );
    
    if (!newQuestionnaire || newQuestionnaire.length === 0) {
      throw new Error('No se pudo recuperar el cuestionario recién creado');
    }
    
    res.status(201).json({
      message: 'Cuestionario creado correctamente',
      data: newQuestionnaire[0]
    });
    
  } catch (error) {
    console.error('Error al crear cuestionario:', error);
    
    // Manejar errores de duplicados
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Ya existe un cuestionario con ese título',
        error: 'DUPLICATE_ENTRY'
      });
    }
    
    res.status(500).json({
      message: 'Error del servidor al crear el cuestionario',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtener todos los cuestionarios (protegido y filtrado por rol)
router.get('/', verifyToken, isTeacherOrAdmin, async (req, res) => {
  console.log('=== INICIO DE SOLICITUD DE CUESTIONARIOS ===');
  console.log('Usuario autenticado:', {
    id: req.user.id,
    role: req.user.role,
    teacher_id: req.user.teacher_id
  });
  console.log('Query params:', req.query);
  
  try {
    const { phase, grade, studentId, description } = req.query;
    let params = [];
    let conditions = [];
    
    // Consulta base con las relaciones según el esquema de la base de datos
    let query = `
      SELECT 
        q.id,
        q.title,
        q.description,
        q.course_id,
        q.created_by as teacher_id,
        q.created_at,
        q.updated_at,
        q.phase,
        q.grade,
        q.category,
        u.name as teacher_name,
        c.name as course_name,
        (SELECT COUNT(*) FROM questions WHERE questionnaire_id = q.id) as question_count
      FROM questionnaires q
      INNER JOIN teachers t ON q.created_by = t.id
      INNER JOIN users u ON t.user_id = u.id
      LEFT JOIN courses c ON q.course_id = c.id
    `;
    
    // Manejo de autenticación y filtrado
    if (req.user.role === 'super_administrador') {
      // El administrador puede ver todos los cuestionarios o filtrar por created_by si se especifica
      if (req.query.created_by) {
        conditions.push('q.created_by = ?');
        params.push(parseInt(req.query.created_by));
        console.log('Filtrando por profesor (especificado en URL):', req.query.created_by);
      }
    } else if (req.user.role === 'docente') {
      // Para docentes, obtenemos su teacher_id
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [req.user.id]
      );
      
      if (teacherRows.length === 0) {
        console.log('Usuario no tiene perfil de profesor:', req.user.id);
        return res.json({
          success: true,
          count: 0,
          data: []
        });
      }
      
      const teacherId = teacherRows[0].id;
      
      // Si se especificó un created_by, verificamos que coincida con el docente autenticado
      if (req.query.created_by) {
        if (parseInt(req.query.created_by) !== teacherId) {
          return res.status(403).json({
            success: false,
            message: 'No autorizado para ver cuestionarios de otros docentes'
          });
        }
      }
      
      // Filtramos por el teacher_id del docente autenticado
      conditions.push('q.created_by = ?');
      params.push(teacherId);
      
      console.log('Filtrando por profesor autenticado:', { 
        userId: req.user.id, 
        userEmail: req.user.email,
        teacherId: teacherId 
      });
    } else {
      // Si no es ni docente ni administrador, no mostrar nada
      conditions.push('1=0');
    }
    
    // Si hay un studentId, filtrar por el grado del estudiante
    if (studentId) {
      // Obtener el grado y course_id del estudiante
      const [studentRows] = await pool.query(
        'SELECT grade, course_id FROM students WHERE user_id = ?',
        [studentId]
      );

      if (studentRows.length > 0) {
        const studentGrade = studentRows[0].grade;
        // Filtrar cuestionarios por el grado del estudiante
        conditions.push('q.grade = ?');
        params.push(studentGrade);
      } else {
        // Si no se encuentra el estudiante, devolver un array vacío
        return res.json([]);
      }
    }
    
    // Filtros adicionales
    if (phase) {
      conditions.push('q.phase = ?');
      params.push(phase);
    }
    
    if (grade) {
      conditions.push('q.grade = ?');
      params.push(grade);
    }

    if (description) {
      conditions.push('q.description LIKE ?');
      params.push(`%${description}%`);
    }

    // Aplicar condiciones WHERE si existen
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Ordenar por fecha de creación descendente
    query += ' ORDER BY q.created_at DESC';
    
    // Ejecutar la consulta
    console.log('\n=== CONSULTA SQL ===');
    console.log('SQL:', query);
    console.log('Parámetros:', params);
    
    const [rows] = await pool.query(query, params);
    
    console.log('\n=== RESULTADOS ===');
    console.log('Número de filas:', rows.length);
    console.log('Primeras 2 filas:', JSON.stringify(rows.slice(0, 2), null, 2));
    
    // Formatear la respuesta según lo esperado por el frontend
    const formattedRows = rows.map(q => ({
      id: q.id,
      title: q.title,
      category: q.category,
      grade: q.grade,
      phase: q.phase,
      created_at: q.created_at,
      course_id: q.course_id,
      created_by: q.created_by,
      description: q.description,
      teacher_name: q.teacher_name,
      course_name: q.course_name,
      subject_name: q.category ? q.category.split('_')[1] || '' : '',
      metadata: {
        question_count: q.question_count || 0
      }
    }));
    
    res.json({
      success: true,
      count: formattedRows.length,
      data: formattedRows
    });
  } catch (error) {
    console.error('❌ Error al obtener cuestionarios:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener cuestionarios',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtener un cuestionario específico por ID (protegido)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        q.id, q.title, q.category, q.grade, q.phase, q.created_at, q.course_id, q.created_by, q.description,
        u.name as created_by_name,
        c.name as course_name
      FROM questionnaires q
      JOIN teachers t ON q.created_by = t.id
      JOIN users u ON t.user_id = u.id
      JOIN courses c ON q.course_id = c.id
      WHERE q.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado' });
    }
    
    // Obtener las preguntas asociadas al cuestionario
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id = ?',
      [id]
    );
    
    res.json({
      questionnaire: rows[0],
      questions
    });
  } catch (error) {
    console.error('❌ Error al obtener cuestionario:', error);
    res.status(500).json({ message: 'Error al obtener cuestionario' });
  }
});

// Crear un nuevo cuestionario (protegido)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, category, grade, phase, course_id, created_by, description } = req.body;
    
    console.log('Datos recibidos para crear cuestionario:', req.body);
    
    // Validar que todos los campos necesarios estén presentes
    if (!title || !category || !grade || !phase || !course_id || !created_by || !description) {
      console.log('Faltan campos requeridos:', { title, category, grade, phase, course_id, created_by, description });
      return res.status(400).json({ 
        message: 'Faltan campos requeridos', 
        received: { title, category, grade, phase, course_id, created_by, description } 
      });
    }
    
    // Obtener el ID del profesor si se proporciona el ID de usuario
    let teacherId = created_by;
    
    // Verificar si created_by es un ID de usuario
    if (created_by > 0) {
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [created_by]
      );
      
      if (teacherRows.length > 0) {
        teacherId = teacherRows[0].id;
      }
    }
    
    const [result] = await pool.query(
      `INSERT INTO questionnaires (title, category, grade, phase, course_id, created_by, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, category, grade, phase, course_id, teacherId, description]
    );
    
    res.status(201).json({ 
      message: 'Cuestionario creado correctamente', 
      id: result.insertId 
    });
  } catch (error) {
    console.error('❌ Error al crear cuestionario:', error);
    res.status(500).json({ message: 'Error al crear cuestionario' });
  }
});

// Actualizar un cuestionario existente (protegido)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, grade, phase, course_id, description } = req.body;
    
    const [result] = await pool.query(
      `UPDATE questionnaires 
       SET title = ?, category = ?, grade = ?, phase = ?, course_id = ?, description = ? 
       WHERE id = ?`,
      [title, category, grade, phase, course_id, description, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado' });
    }
    
    res.json({ message: 'Cuestionario actualizado correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar cuestionario:', error);
    res.status(500).json({ message: 'Error al actualizar cuestionario' });
  }
});

// Eliminar un cuestionario (protegido)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Primero eliminar las preguntas asociadas
    await pool.query('DELETE FROM questions WHERE questionnaire_id = ?', [id]);
    
    // Luego eliminar el cuestionario
    const [result] = await pool.query('DELETE FROM questionnaires WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cuestionario no encontrado' });
    }
    
    res.json({ message: 'Cuestionario y sus preguntas eliminados correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar cuestionario:', error);
    res.status(500).json({ message: 'Error al eliminar cuestionario' });
  }
});



export default router;
