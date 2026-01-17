// routes/teacherCoursesRoutes.js
import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// Obtener todos los cursos asignados a un profesor
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    // Verificar si el campo role existe en teacher_courses
    let hasRole = false;
    try {
      const [roleCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'teacher_courses' 
        AND COLUMN_NAME = 'role'
      `);
      hasRole = roleCols.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    // Verificar si el campo institution existe en courses
    let hasInstitution = false;
    try {
      const [instCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = instCols.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    let roleField = '';
    if (hasRole) {
      roleField = ', tc.role';
    }
    
    let institutionField = '';
    if (hasInstitution) {
      institutionField = ', c.institution';
    }
    
    const [rows] = await pool.query(`
      SELECT tc.id, tc.assigned_date, tc.teacher_id, 
             c.id as course_id, c.name as course_name, c.grade${institutionField}${roleField}
      FROM teacher_courses tc
      JOIN courses c ON tc.course_id = c.id
      WHERE tc.teacher_id = ?
      ORDER BY tc.assigned_date DESC
    `, [teacherId]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener cursos del profesor:', error);
    res.status(500).json({ message: 'Error al obtener cursos del profesor' });
  }
});

// Obtener el ID del profesor a partir del ID de usuario
router.get('/teacher-id/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [rows] = await pool.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    res.json({ teacherId: rows[0].id });
  } catch (error) {
    console.error('Error al obtener ID del profesor:', error);
    res.status(500).json({ message: 'Error al obtener ID del profesor' });
  }
});

// Asignar un curso a un profesor
router.post('/', async (req, res) => {
  try {
    const { teacher_id, course_id, role } = req.body;
    
    if (!teacher_id || !course_id) {
      return res.status(400).json({ message: 'Se requiere teacher_id y course_id' });
    }
    
    // Verificar si la asignación ya existe
    const [existing] = await pool.query(
      'SELECT * FROM teacher_courses WHERE teacher_id = ? AND course_id = ?',
      [teacher_id, course_id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Este curso ya está asignado al profesor' });
    }
    
    // Verificar si el campo role existe en teacher_courses
    let hasRole = false;
    try {
      const [roleCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'teacher_courses' 
        AND COLUMN_NAME = 'role'
      `);
      hasRole = roleCols.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    // Crear la asignación con fecha actual y role si existe
    let result;
    if (hasRole && role) {
      [result] = await pool.query(
        'INSERT INTO teacher_courses (teacher_id, course_id, assigned_date, role) VALUES (?, ?, NOW(), ?)',
        [teacher_id, course_id, role]
      );
    } else {
      [result] = await pool.query(
        'INSERT INTO teacher_courses (teacher_id, course_id, assigned_date) VALUES (?, ?, NOW())',
        [teacher_id, course_id]
      );
    }
    
    res.status(201).json({ 
      id: result.insertId,
      teacher_id,
      course_id,
      role: hasRole && role ? role : null,
      message: 'Curso asignado correctamente al profesor'
    });
  } catch (error) {
    console.error('Error al asignar curso:', error);
    res.status(500).json({ message: 'Error al asignar curso', error: error.message });
  }
});

// Actualizar la asignación de un curso
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { course_id, teacher_id, role } = req.body;
    
    // Verificar si la asignación existe y obtener datos actuales
    const [existing] = await pool.query(
      'SELECT teacher_id, course_id FROM teacher_courses WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }
    
    const currentTeacherId = teacher_id || existing[0].teacher_id;
    const currentCourseId = course_id || existing[0].course_id;
    
    // Si se cambió el curso o el docente, verificar duplicados
    if ((course_id && course_id != existing[0].course_id) || (teacher_id && teacher_id != existing[0].teacher_id)) {
      const [duplicate] = await pool.query(
        'SELECT * FROM teacher_courses WHERE teacher_id = ? AND course_id = ? AND id != ?',
        [currentTeacherId, currentCourseId, id]
      );
      
      if (duplicate.length > 0) {
        return res.status(400).json({ message: 'Este curso ya está asignado al profesor' });
      }
    }
    
    // Verificar si el campo role existe en teacher_courses
    let hasRole = false;
    try {
      const [roleCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'teacher_courses' 
        AND COLUMN_NAME = 'role'
      `);
      hasRole = roleCols.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    // Construir la consulta UPDATE dinámicamente
    const updates = [];
    const params = [];
    
    if (course_id) {
      updates.push('course_id = ?');
      params.push(course_id);
    }
    
    if (teacher_id) {
      updates.push('teacher_id = ?');
      params.push(teacher_id);
    }
    
    if (hasRole && role !== undefined) {
      updates.push('role = ?');
      params.push(role || null);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }
    
    params.push(id);
    
    // Actualizar la asignación en teacher_courses
    const [result] = await pool.query(
      `UPDATE teacher_courses SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }
    
    // Si se cambió el course_id o teacher_id, también actualizar courses.teacher_id si corresponde
    // (solo si el curso tenía este docente como principal)
    if (course_id && course_id != existing[0].course_id) {
      // Verificar si el curso anterior tenía a este docente como principal
      const [oldCourse] = await pool.query('SELECT teacher_id FROM courses WHERE id = ?', [existing[0].course_id]);
      if (oldCourse.length > 0 && oldCourse[0].teacher_id == existing[0].teacher_id) {
        // Limpiar teacher_id del curso anterior ya que el docente ya no está asignado
        await pool.query('UPDATE courses SET teacher_id = NULL WHERE id = ?', [existing[0].course_id]);
      }
      
      // Si el nuevo curso no tiene teacher_id y este docente es principal, asignarlo
      const [newCourse] = await pool.query('SELECT teacher_id FROM courses WHERE id = ?', [course_id]);
      if (newCourse.length > 0 && !newCourse[0].teacher_id && hasRole && role === 'principal') {
        await pool.query('UPDATE courses SET teacher_id = ? WHERE id = ?', [currentTeacherId, course_id]);
      }
    }
    
    res.json({ 
      message: 'Asignación actualizada correctamente',
      data: { id: parseInt(id), teacher_id: currentTeacherId, course_id: currentCourseId, role: hasRole && role ? role : null }
    });
  } catch (error) {
    console.error('Error al actualizar asignación:', error);
    res.status(500).json({ message: 'Error al actualizar asignación', error: error.message });
  }
});

// Eliminar la asignación de un curso a un profesor
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.query(
      'DELETE FROM teacher_courses WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }
    
    res.json({ message: 'Asignación eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar asignación:', error);
    res.status(500).json({ message: 'Error al eliminar asignación' });
  }
});

// Actualizar el assigned_date de registros existentes con NULL
router.patch('/fix-dates', async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE teacher_courses SET assigned_date = NOW() WHERE assigned_date IS NULL'
    );
    
    res.json({ 
      message: 'Fechas actualizadas correctamente',
      updatedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error al actualizar fechas:', error);
    res.status(500).json({ message: 'Error al actualizar fechas' });
  }
});

export default router;
