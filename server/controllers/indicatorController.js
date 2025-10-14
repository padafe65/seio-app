// controllers/indicatorController.js
import pool from '../config/db.js';

/**
 * Obtiene todos los indicadores con filtros opcionales
 */
export const getIndicators = async (req, res) => {
  const { teacher_id, student_id, subject, phase, questionnaire_id } = req.query;
  
  try {
    let query = `
      SELECT DISTINCT
        i.id,
        i.description,
        i.subject,
        i.grade,
        i.phase,
        i.created_at,
        i.questionnaire_id,
        q.title as questionnaire_title,
        t.id as teacher_id,
        u.name as teacher_name
      FROM indicators i
      JOIN teachers t ON i.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
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
      query += `
        AND EXISTS (
          SELECT 1 FROM student_indicators si 
          WHERE si.indicator_id = i.id AND si.student_id = ?
        )
      `;
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
    
    // Removed questionnaire_id filter since there's no direct relationship in the schema
    
    query += ' ORDER BY i.created_at DESC';
    
    const [indicators] = await pool.query(query, params);
    
    // Obtener estudiantes para cada indicador
    for (const indicator of indicators) {
      const [students] = await pool.query(
        `SELECT s.id, u.name, u.email 
         FROM student_indicators si
         JOIN students s ON si.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE si.indicator_id = ?`,
        [indicator.id]
      );
      
      indicator.students = students;
    }
    
    res.json({
      success: true,
      data: indicators,
      count: indicators.length,
      message: 'Indicadores obtenidos exitosamente'
    });
    
  } catch (error) {
    console.error('Error al obtener indicadores:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener indicadores', 
      error: error.message 
    });
  }
};

/**
 * Obtiene un indicador por su ID
 */
export const getIndicatorById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [indicators] = await pool.query(
      `SELECT 
         i.*, 
         t.id as teacher_id, 
         u.name as teacher_name,
         q.id as questionnaire_id,
         q.title as questionnaire_title
       FROM indicators i
       LEFT JOIN teachers t ON i.teacher_id = t.id
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN questionnaires q ON i.questionnaire_id = q.id
       WHERE i.id = ?`,
      [id]
    );
    
    if (indicators.length === 0) {
      return res.status(404).json({ message: 'Indicador no encontrado' });
    }
    
    const indicator = indicators[0];
    
    // Obtener estudiantes asociados
    const [students] = await pool.query(
      `SELECT s.id, u.name, u.email 
       FROM student_indicators si
       JOIN students s ON si.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE si.indicator_id = ?`,
      [id]
    );
    
    indicator.students = students;
    
    res.json(indicator);
    
  } catch (error) {
    console.error('Error al obtener indicador:', error);
    res.status(500).json({ message: 'Error al obtener el indicador', error: error.message });
  }
};

/**
 * Crea un nuevo indicador
 */
export const createIndicator = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { description, subject, phase, achieved, teacher_id, questionnaire_id, student_ids } = req.body;
    
    // Validar datos requeridos
    if (!description || !subject || !phase || teacher_id === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan campos requeridos: description, subject, phase, teacher_id' 
      });
    }
    
    // Insertar el indicador
    const [result] = await connection.query(
      `INSERT INTO indicators 
       (description, subject, phase, teacher_id, questionnaire_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [description, subject, phase, teacher_id, questionnaire_id || null]
    );
    
    const indicatorId = result.insertId;
    
    // Asociar estudiantes si se proporcionaron
    if (student_ids && student_ids.length > 0) {
      const studentValues = student_ids.map(studentId => [
        indicatorId, 
        studentId,
        false, // achieved por defecto es falso
        new Date(), // created_at
        new Date()  // updated_at
      ]);
      
      await connection.query(
        `INSERT INTO student_indicators 
         (indicator_id, student_id, achieved, created_at, updated_at)
         VALUES ?`,
        [studentValues]
      );
    }
    
    await connection.commit();
    
    // Obtener el indicador recién creado con sus relaciones
    const [newIndicator] = await pool.query(
      `SELECT i.*, t.id as teacher_id, u.name as teacher_name
       FROM indicators i
       LEFT JOIN teachers t ON i.teacher_id = t.id
       LEFT JOIN users u ON t.user_id = u.id
       WHERE i.id = ?`,
      [indicatorId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Indicador creado exitosamente',
      indicator: newIndicator[0]
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear indicador:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear el indicador', 
      error: error.message 
    });
  } finally {
    connection.release();
  }
};

/**
 * Actualiza un indicador existente
 */
export const updateIndicator = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { description, subject, phase, achieved, questionnaire_id, student_ids } = req.body;
    
    // Actualizar el indicador
    await connection.query(
      `UPDATE indicators 
       SET description = ?, subject = ?, phase = ?, questionnaire_id = ?
       WHERE id = ?`,
      [description, subject, phase, questionnaire_id || null, id]
    );
    
    // Si se proporcionaron estudiantes, actualizar las relaciones
    if (student_ids && Array.isArray(student_ids)) {
      const now = new Date();
      
      // Obtener el parámetro de filtrado del query string
      const isFiltered = req.query.isFiltered === 'true';
      
      console.log('🔍 Parámetros de la solicitud:', {
        isFiltered,
        studentCount: student_ids.length,
        studentIds: student_ids,
        queryParams: req.query
      });
      
      // Si es una operación de filtrado (solo un estudiante), solo actualizamos/agregamos ese estudiante
      if (isFiltered && student_ids.length === 1) {
        const studentId = student_ids[0];
        
        console.log(`🔄 Modo filtrado: Actualizando solo el estudiante ${studentId}`);
        
        // Verificar si ya existe una relación para este estudiante
        const [existingRelation] = await connection.query(
          'SELECT id, achieved FROM student_indicators WHERE indicator_id = ? AND student_id = ?',
          [id, studentId]
        );
        
        if (existingRelation.length > 0) {
          // Actualizar relación existente
          console.log(`✅ Actualizando relación existente para estudiante ${studentId}`);
          await connection.query(
            `UPDATE student_indicators 
             SET updated_at = ?
             WHERE indicator_id = ? AND student_id = ?`,
            [now, id, studentId]
          );
        } else {
          // Crear nueva relación
          console.log(`➕ Creando nueva relación para estudiante ${studentId}`);
          await connection.query(
            `INSERT INTO student_indicators 
             (indicator_id, student_id, achieved, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [id, studentId, false, now, now]
          );
        }
      } else {
        console.log(`🔄 Modo asignación masiva: Procesando ${student_ids.length} estudiantes`);
        
        // Si no es un filtrado, es una asignación masiva y debemos sincronizar
        // Obtener las relaciones existentes
        const [existingRelations] = await connection.query(
          'SELECT student_id, achieved FROM student_indicators WHERE indicator_id = ?',
          [id]
        );

        // Crear un mapa de relaciones existentes para búsqueda rápida
        const existingMap = new Map(
          existingRelations.map(rel => [rel.student_id.toString(), rel.achieved])
        );

        // Identificar relaciones a eliminar (las que ya no están en student_ids)
        const studentIdsToKeep = new Set(student_ids.map(id => id.toString()));
        const relationsToDelete = existingRelations
          .filter(rel => !studentIdsToKeep.has(rel.student_id.toString()))
          .map(rel => rel.student_id);

        // Eliminar solo las relaciones que ya no son necesarias
        if (relationsToDelete.length > 0) {
          console.log(`➖ Eliminando ${relationsToDelete.length} relaciones:`, relationsToDelete);
          
          // Usar una transacción para asegurar que la operación sea atómica
          await connection.beginTransaction();
          
          try {
            // Primero, eliminar las relaciones existentes
            await connection.query(
              'DELETE FROM student_indicators WHERE indicator_id = ? AND student_id IN (?)',
              [id, relationsToDelete]
            );
            
            // Registrar en el log para depuración
            console.log(`✅ Relaciones eliminadas exitosamente`);
            
            // Confirmar la transacción
            await connection.commit();
          } catch (error) {
            // Revertir la transacción en caso de error
            await connection.rollback();
            console.error('Error al eliminar relaciones:', error);
            throw error; // Relanzar el error para manejarlo en el catch externo
          }
        }

        // Identificar relaciones a agregar (las que no están en existingMap)
        const relationsToAdd = student_ids
          .filter(studentId => !existingMap.has(studentId.toString()))
          .map(studentId => [
            id,
            studentId,
            false, // achieved por defecto
            now,   // created_at
            now    // updated_at
          ]);

        // Agregar nuevas relaciones si las hay
        if (relationsToAdd.length > 0) {
          console.log(`➕ Agregando ${relationsToAdd.length} nuevas relaciones`);
          await connection.query(
            `INSERT INTO student_indicators 
             (indicator_id, student_id, achieved, created_at, updated_at)
             VALUES ?`,
            [relationsToAdd]
          );
        }

        // Actualizar la fecha de actualización de las relaciones existentes que se mantienen
        const relationsToUpdate = student_ids
          .filter(studentId => existingMap.has(studentId.toString()));

        if (relationsToUpdate.length > 0) {
          console.log(`🔄 Actualizando ${relationsToUpdate.length} relaciones existentes`);
          await connection.query(
            `UPDATE student_indicators 
             SET updated_at = ? 
             WHERE indicator_id = ? AND student_id IN (?)`,
            [now, id, relationsToUpdate]
          );
        }
      }
    }
    
    await connection.commit();
    
    // Obtener el indicador actualizado con sus relaciones
    const [updatedIndicator] = await pool.query(
      `SELECT i.*, t.id as teacher_id, u.name as teacher_name
       FROM indicators i
       LEFT JOIN teachers t ON i.teacher_id = t.id
       LEFT JOIN users u ON t.user_id = u.id
       WHERE i.id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'Indicador actualizado exitosamente',
      indicator: updatedIndicator[0]
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar indicador:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar el indicador', 
      error: error.message 
    });
  } finally {
    connection.release();
  }
};

/**
 * Elimina un indicador
 */
export const deleteIndicator = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    // Eliminar relaciones con estudiantes primero
    await connection.query(
      'DELETE FROM student_indicators WHERE indicator_id = ?',
      [id]
    );
    
    // Luego eliminar el indicador
    await connection.query(
      'DELETE FROM indicators WHERE id = ?',
      [id]
    );
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      message: 'Indicador eliminado exitosamente' 
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al eliminar indicador:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar el indicador', 
      error: error.message 
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtiene los indicadores de un estudiante específico
 */
export const getStudentIndicators = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Obtener el ID del estudiante a partir del ID de usuario
    const [students] = await pool.query(
      `SELECT s.id 
       FROM students s 
       WHERE s.user_id = ?`,
      [userId]
    );
    
    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Estudiante no encontrado' 
      });
    }
    
    const studentId = students[0].id;
    
    // Obtener los indicadores del estudiante
    const [indicators] = await pool.query(
      `SELECT 
         i.id, i.description, i.subject, i.phase, i.achieved,
         i.created_at, i.updated_at,
         t.id as teacher_id, u.name as teacher_name,
         q.title as questionnaire_title, q.id as questionnaire_id
       FROM indicators i
       JOIN student_indicators si ON i.id = si.indicator_id
       LEFT JOIN teachers t ON i.teacher_id = t.id
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN questionnaires q ON i.questionnaire_id = q.id
       WHERE si.student_id = ?
       ORDER BY i.phase, i.subject, i.created_at`,
      [studentId]
    );
    
    res.json(indicators);
    
  } catch (error) {
    console.error('Error al obtener indicadores del estudiante:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener los indicadores del estudiante', 
      error: error.message 
    });
  }
};

/**
 * Obtiene los estudiantes asociados a un indicador
 */
export const getIndicatorStudents = async (req, res) => {
  try {
    const { id: indicatorId } = req.params;
    
    const [students] = await pool.query(
      `SELECT s.id, u.name, u.email, u.phone, si.achieved
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN student_indicators si ON s.id = si.student_id
       WHERE si.indicator_id = ?`,
      [indicatorId]
    );
    
    res.json(students);
    
  } catch (error) {
    console.error('Error al obtener estudiantes del indicador:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener los estudiantes del indicador', 
      error: error.message 
    });
  }
};

/**
 * Elimina un estudiante de un indicador
 */
export const removeStudentFromIndicator = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { indicatorId, studentId } = req.params;
    
    // Verificar que exista la relación
    const [existing] = await connection.query(
      `SELECT * FROM student_indicators 
       WHERE indicator_id = ? AND student_id = ?`,
      [indicatorId, studentId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró la relación entre el estudiante y el indicador'
      });
    }
    
    // Eliminar la relación
    await connection.query(
      `DELETE FROM student_indicators 
       WHERE indicator_id = ? AND student_id = ?`,
      [indicatorId, studentId]
    );
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Estudiante eliminado del indicador exitosamente'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al eliminar estudiante del indicador:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar el estudiante del indicador', 
      error: error.message 
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtiene los cuestionarios de un docente
 */
export const getTeacherQuestionnaires = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Obtener el ID del docente a partir del ID de usuario
    const [teachers] = await pool.query(
      `SELECT t.id 
       FROM teachers t 
       WHERE t.user_id = ?`,
      [userId]
    );
    
    if (teachers.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Docente no encontrado',
        data: []
      });
    }
    
    const teacherId = teachers[0].id;
    
    // Obtener los cuestionarios del docente con información relacionada
    const [questionnaires] = await pool.query(
      `SELECT 
        q.id, 
        q.title, 
        q.description, 
        q.created_at,
        q.course_id,
        q.created_by,
        u.name as created_by_name,
        c.name as course_name,
        (SELECT COUNT(*) FROM questions WHERE questionnaire_id = q.id) as question_count
      FROM questionnaires q
      LEFT JOIN teachers t ON q.created_by = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE q.created_by = ?
      ORDER BY q.created_at DESC`,
      [teacherId]
    );
    
    res.json({
      success: true,
      data: questionnaires,
      count: questionnaires.length,
      message: 'Cuestionarios obtenidos exitosamente'
    });
    
  } catch (error) {
    console.error('Error al obtener cuestionarios del docente:', error);
    res.status(500).json({ 
      success: false, 
      data: [],
      message: 'Error al obtener los cuestionarios del docente', 
      error: error.message 
    });
  }
};
