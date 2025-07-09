import pool from '../config/db.js';

// Obtener todos los estudiantes (solo administradores)
export const getStudents = async (req, res) => {
  try {
    // Si llegamos aquí, el middleware isAdmin ya ha verificado que el usuario es administrador
    const query = `
      SELECT 
        s.*, 
        u.email as user_email,
        u.phone as user_phone,
        u.role,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      ORDER BY s.name
    `;

    const [students] = await pool.query(query);
    
    res.json(students);
  } catch (error) {
    console.error('Error al obtener estudiantes:', error);
    res.status(500).json({ 
      message: 'Error del servidor al obtener estudiantes',
      error: error.message
    });
  }
};

// Obtener un estudiante por ID
export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Si es docente, verificar que el estudiante esté asignado a él
    if (userRole === 'docente') {
      const [teacherStudents] = await pool.query(
        'SELECT ts.student_id FROM teacher_students ts ' +
        'JOIN teachers t ON ts.teacher_id = t.id ' +
        'WHERE t.user_id = ? AND ts.student_id = ?',
        [userId, id]
      );

      if (teacherStudents.length === 0) {
        return res.status(403).json({ 
          success: false,
          message: 'No tienes permiso para ver este estudiante',
          error: 'FORBIDDEN'
        });
      }
    }
    // Si es estudiante, solo puede ver su propia información
    else if (userRole === 'estudiante' && req.user.student_id !== parseInt(id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Solo puedes ver tu propia información',
        error: 'FORBIDDEN'
      });
    }

    const query = `
      SELECT 
        s.*, 
        u.email as user_email,
        u.phone as user_phone,
        u.role,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.id = ?
    `;

    const [students] = await pool.query(query, [id]);
    
    if (students.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Estudiante no encontrado',
        error: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: students[0]
    });
  } catch (error) {
    console.error('Error al obtener estudiante:', error);
    res.status(500).json({ 
      message: 'Error del servidor al obtener estudiante',
      error: error.message
    });
  }
};

// Las funciones ya están exportadas individualmente
