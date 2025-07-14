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
        u.role, u.id as user_id, u.name as user_name, u.created_at as user_created_at,
        u.estado as user_estado,
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
    
    // Primero, obtener el ID del docente asignado al estudiante
    const [teacherAssignment] = await pool.query(
      'SELECT teacher_id FROM teacher_students WHERE student_id = ? LIMIT 1',
      [id]
    );
    
    const teacherId = teacherAssignment.length > 0 ? teacherAssignment[0].teacher_id : null;
    
    // Luego, obtener los datos del estudiante
    const query = `
      SELECT 
        s.*, 
        u.email as user_email,
        u.phone as user_phone,
        u.role, 
        u.id as user_id, 
        u.name as user_name, 
        u.created_at as user_created_at,
        u.estado as user_estado,
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
    
    // Incluir el teacher_id en la respuesta
    const studentData = {
      ...students[0],
      teacher_id: teacherId
    };
    
    console.log('Datos del estudiante con teacher_id:', studentData);
    
    res.json({
      success: true,
      data: studentData
    });
  } catch (error) {
    console.error('Error al obtener estudiante:', error);
    res.status(500).json({ 
      message: 'Error del servidor al obtener estudiante',
      error: error.message
    });
  }
};

// Actualizar un estudiante existente
export const updateStudent = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const { 
    name, 
    email, 
    phone, 
    contact_email, 
    contact_phone, 
    age, 
    grade, 
    course_id,
    teacher_id 
  } = req.body;

  console.log('=== INICIO updateStudent ===');
  console.log('Datos recibidos para actualizar:', { 
    id, 
    name, 
    email, 
    phone, 
    contact_email, 
    contact_phone, 
    age, 
    grade, 
    course_id,
    teacher_id,
    userId,
    userRole
  });

  // Iniciar una transacción
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Verificar permisos
    if (userRole === 'docente') {
      // Verificar que el estudiante esté asignado a este docente
      const [teacher] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?', 
        [userId]
      );

      if (teacher.length === 0) {
        await connection.rollback();
        return res.status(403).json({ 
          success: false,
          message: 'No estás registrado como docente',
          error: 'TEACHER_NOT_FOUND'
        });
      }

      const [assignment] = await connection.query(
        'SELECT * FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
        [teacher[0].id, id]
      );

      if (assignment.length === 0) {
        await connection.rollback();
        return res.status(403).json({ 
          success: false,
          message: 'No tienes permiso para actualizar este estudiante',
          error: 'FORBIDDEN'
        });
      }
    }

    // 2. Obtener el user_id del estudiante
    const [student] = await connection.query(
      'SELECT user_id FROM students WHERE id = ?',
      [id]
    );

    if (student.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado',
        error: 'NOT_FOUND'
      });
    }

    const userIdToUpdate = student[0].user_id;

    // 3. Actualizar la tabla users
    await connection.query(
      'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name, email, phone, userIdToUpdate]
    );

    // 4. Actualizar la tabla students
    await connection.query(
      `UPDATE students 
       SET contact_email = ?, contact_phone = ?, age = ?, grade = ?, course_id = ? 
       WHERE id = ?`,
      [contact_email, contact_phone, age, grade, course_id, id]
    );

    // 5. Actualizar la relación con el docente si se proporcionó teacher_id
    if (teacher_id) {
      // Verificar que el docente exista (teacher_id es en realidad el user_id)
      const [teacher] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [teacher_id]
      );

      if (teacher.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'El docente especificado no existe',
          error: 'TEACHER_NOT_FOUND',
          details: `No se encontró un docente con user_id: ${teacher_id}`
        });
      }

      const teacherDbId = teacher[0].id;

      // Eliminar asignaciones existentes
      await connection.query(
        'DELETE FROM teacher_students WHERE student_id = ?',
        [id]
      );

      // Crear nueva asignación usando el id real de la tabla teachers
      await connection.query(
        'INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)',
        [teacherDbId, id]
      );
    }

    // Confirmar la transacción
    await connection.commit();

    console.log('=== FIN updateStudent (éxito) ===');
    
    // Obtener los datos actualizados del estudiante
    const [updatedStudent] = await pool.query(
      'SELECT s.*, u.name as user_name, u.email as user_email, u.phone as user_phone ' +
      'FROM students s ' +
      'JOIN users u ON s.user_id = u.id ' +
      'WHERE s.id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Estudiante actualizado correctamente',
      data: updatedStudent[0]
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar estudiante:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al actualizar estudiante',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Las funciones ya están exportadas individualmente
