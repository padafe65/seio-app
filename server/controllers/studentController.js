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

    console.log('=== INICIO getStudentById ===');
    console.log('ID del estudiante solicitado:', id, 'Tipo:', typeof id);
    console.log('Usuario autenticado:', { 
      userId, 
      userRole, 
      teacher_id: req.user.teacher_id,
      student_id: req.user.student_id 
    });

    // Si es docente, verificar que el estudiante esté asignado a él
    if (userRole === 'docente') {
      console.log('Verificando permisos para docente...');
      
      // 1. Primero, obtener el ID del profesor
      const [teacher] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?', 
        [userId]
      );

      if (teacher.length === 0) {
        console.log('Error: No se encontró el registro del profesor');
        return res.status(403).json({ 
          success: false,
          message: 'No estás registrado como docente',
          error: 'TEACHER_NOT_FOUND'
        });
      }

      const teacherId = teacher[0].id;
      console.log('ID del profesor:', teacherId);

      // 2. Verificar si el estudiante está asignado a este profesor
      const [assignment] = await pool.query(
        'SELECT * FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
        [teacherId, id]
      );

      console.log('Resultado de la verificación de asignación:', assignment);

      if (assignment.length === 0) {
        console.log('Error: El estudiante no está asignado a este docente');
        return res.status(403).json({ 
          success: false,
          message: 'No tienes permiso para ver este estudiante',
          error: 'STUDENT_NOT_ASSIGNED',
          debug: {
            teacherId,
            studentId: id,
            userRole,
            userId
          }
        });
      }
    }
    // Si es estudiante, solo puede ver su propia información
    else if (userRole === 'estudiante' && req.user.student_id !== parseInt(id)) {
      console.log('Error: Estudiante intentando acceder a otro estudiante');
      return res.status(403).json({ 
        success: false,
        message: 'Solo puedes ver tu propia información',
        error: 'FORBIDDEN',
        debug: {
          studentId: req.user.student_id,
          requestedId: id
        }
      });
    }

    console.log('Permiso concedido, obteniendo datos del estudiante...');
    
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

    console.log('Ejecutando consulta SQL:', query.replace(/\s+/g, ' ').trim());
    console.log('Con parámetros:', [id]);
    
    const [students] = await pool.query(query, [id]);
    
    console.log('Resultado de la consulta:', students);
    
    if (students.length === 0) {
      console.log('Error: Estudiante no encontrado en la base de datos');
      return res.status(404).json({ 
        success: false,
        message: 'Estudiante no encontrado',
        error: 'NOT_FOUND',
        debug: {
          studentId: id
        }
      });
    }

    console.log('=== FIN getStudentById (éxito) ===');
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
