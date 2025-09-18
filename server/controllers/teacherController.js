import { db } from '../config/db.js';

export const getTeacherByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el ID de usuario'
      });
    }

    console.log(`🔍 Buscando profesor con user_id: ${userId}`);
    
    // Buscar el profesor por user_id incluyendo la información del usuario
    const [teachers] = await db.query(
      `SELECT t.*, u.name, u.email, u.phone, u.role 
       FROM teachers t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.user_id = ?`,
      [userId]
    );

    if (!teachers || teachers.length === 0) {
      console.log(`❌ No se encontró profesor con user_id: ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'No se encontró el profesor con el ID de usuario proporcionado'
      });
    }

    const teacher = teachers[0];
    console.log(`✅ Profesor encontrado:`, { id: teacher.id, name: teacher.name });

    // Obtener los cursos asignados al profesor
    const [courses] = await db.query(
      `SELECT c.* 
       FROM teacher_courses tc
       JOIN courses c ON tc.course_id = c.id
       WHERE tc.teacher_id = ?`,
      [teacher.id]
    );

    // Obtener los estudiantes asignados al profesor
    const [students] = await db.query(
      `SELECT s.*, u.name, u.email, u.phone, c.name as course_name
       FROM teacher_students ts
       JOIN students s ON ts.student_id = s.id
       JOIN users u ON s.user_id = u.id
       LEFT JOIN courses c ON s.course_id = c.id
       WHERE ts.teacher_id = ?`,
      [teacher.id]
    );

    // Obtener los cuestionarios creados por el profesor
    const [questionnaires] = await db.query(
      `SELECT * FROM questionnaires WHERE created_by = ?`,
      [teacher.id]
    );

    // Obtener los indicadores creados por el profesor
    const [indicators] = await db.query(
      `SELECT * FROM indicators WHERE teacher_id = ?`,
      [teacher.id]
    );

    // Estructurar la respuesta
    const teacherData = {
      id: teacher.id,
      user_id: teacher.user_id,
      subject: teacher.subject,
      institution: teacher.institution,
      user: {
        id: teacher.user_id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        role: teacher.role
      },
      courses: courses || [],
      students: students || [],
      questionnaires: questionnaires || [],
      indicators: indicators || []
    };

    // Asegurarse de que la respuesta tenga el formato esperado
    res.status(200).json({
      success: true,
      data: teacherData
    });

  } catch (error) {
    console.error('❌ Error en getTeacherByUserId:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al obtener información del profesor',
      error: error.message
    });
  }
};

/**
 * Obtiene los estudiantes de un docente filtrados por grado
 */
export const getStudentsByGrade = async (req, res) => {
  try {
    const { teacherId, grade } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    console.log('\n🔍 ===== SOLICITUD DE ESTUDIANTES POR GRADO =====');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`👤 Usuario solicitante: ${requestingUserId} (${requestingUserRole})`);
    console.log(`📌 Parámetros: teacherId=${teacherId}, grade=${grade}`);
    console.log('🔍 Headers:', {
      authorization: req.headers.authorization ? 'Presente' : 'No presente',
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    });
    
    // Validar parámetros
    if (!teacherId || !grade) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren tanto el ID del docente como el grado'
      });
    }

    // Validar que el teacherId sea un número
    if (isNaN(teacherId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de docente no válido'
      });
    }

    // Validar que el grado sea un número
    if (isNaN(grade)) {
      return res.status(400).json({
        success: false,
        message: 'Grado no válido'
      });
    }

    // Verificar que el docente exista
    const [teacher] = await db.query(
      'SELECT id, user_id, subject FROM teachers WHERE id = ?',
      [teacherId]
    );
    
    console.log('📋 Información del docente solicitado:', teacher[0] || 'No encontrado');
    
    if (!teacher || teacher.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el docente especificado',
        error: 'NOT_FOUND'
      });
    }
    
    // Si el usuario es docente, verificar que solo pueda ver sus propios estudiantes
    if (requestingUserRole === 'docente') {
      console.log('🔐 Verificando permisos del docente...');
      const [requestingTeacher] = await db.query(
        'SELECT id, user_id FROM teachers WHERE user_id = ?',
        [requestingUserId]
      );
      
      console.log('📋 Información del docente autenticado:', requestingTeacher[0] || 'No encontrado');
      
      if (!requestingTeacher || requestingTeacher.length === 0 || 
          requestingTeacher[0].id.toString() !== teacherId) {
        const errorMsg = '❌ Intento de acceso no autorizado a estudiantes de otro docente';
        console.error(errorMsg, {
          requestedTeacherId: teacherId,
          authenticatedTeacherId: requestingTeacher?.[0]?.id,
          userId: requestingUserId
        });
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver los estudiantes de este docente',
          error: 'FORBIDDEN'
        });
      }
      
      console.log('✅ Permisos del docente verificados correctamente');
    }

    // Consulta para obtener los estudiantes del docente filtrados por grado
    const query = `
      SELECT 
        s.id,
        u.name,
        s.grade,
        c.name as course_name,
        s.course_id,
        u.estado,
        ts.created_at as assigned_date
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN teacher_students ts ON s.id = ts.student_id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE ts.teacher_id = ? 
        AND s.grade = ? 
        AND u.estado = 'activo'
      ORDER BY u.name ASC
    `;
    
    console.log('\n📝 Ejecutando consulta SQL:');
    console.log(query);
    console.log('📌 Parámetros:', [teacherId, grade]);
    
    console.log('\n🔍 Verificando datos en la base de datos...');
    
    // Verificar si el docente existe
    const [teacherCheck] = await db.query('SELECT id FROM teachers WHERE id = ?', [teacherId]);
    console.log(`👨‍🏫 Docente con ID ${teacherId} existe:`, teacherCheck.length > 0 ? 'Sí' : 'No');
    
    // Verificar si hay estudiantes asignados al docente
    const [assignedStudents] = await db.query(
      'SELECT COUNT(*) as count FROM teacher_students WHERE teacher_id = ?', 
      [teacherId]
    );
    console.log(`📊 Total de estudiantes asignados al docente: ${assignedStudents[0].count}`);
    
    // Verificar si hay estudiantes en el grado especificado
    const [gradeStudents] = await db.query(
      'SELECT COUNT(*) as count FROM students WHERE grade = ?', 
      [grade]
    );
    console.log(`📊 Total de estudiantes en el grado ${grade}: ${gradeStudents[0].count}`);
    
    // Ejecutar la consulta principal
    const [students] = await db.query(query, [teacherId, grade]);
    
    console.log('\n📊 Resultados de la consulta:');
    console.log(`✅ Se encontraron ${students.length} estudiantes para el docente ${teacherId}, grado ${grade}`);
    if (students.length > 0) {
      console.log('📋 Muestra de estudiantes encontrados (máx 5):', 
        students.slice(0, 5).map(s => `${s.name} (ID: ${s.id}, Grado: ${s.grade})`)
      );
    }
    
    res.status(200).json({
      success: true,
      data: students,
      _debug: {
        teacherExists: teacherCheck.length > 0,
        totalAssignedStudents: assignedStudents[0].count,
        totalStudentsInGrade: gradeStudents[0].count
      }
    });
    
  } catch (error) {
    console.error('❌ Error al obtener estudiantes por grado:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al obtener estudiantes por grado',
      error: error.message
    });
  }
};

export const getTeacherIndicators = async (req, res) => {
  try {
    const { teacherId } = req.params;

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el ID del profesor'
      });
    }

    console.log(`🔍 Obteniendo indicadores para el profesor ID: ${teacherId}`);

    // Verificar que el profesor existe
    const [teachers] = await db.query(
      'SELECT id FROM teachers WHERE id = ?',
      [teacherId]
    );

    if (!teachers || teachers.length === 0) {
      console.log(`❌ No se encontró profesor con ID: ${teacherId}`);
      return res.status(404).json({
        success: false,
        message: 'No se encontró el profesor con el ID proporcionado'
      });
    }

    // Obtener los indicadores del profesor con información relacionada
    const [indicators] = await db.query(
      `SELECT i.*, 
              q.title as questionnaire_title,
              q.grade as questionnaire_grade,
              q.phase as questionnaire_phase,
              COUNT(DISTINCT si.student_id) as assigned_students_count
       FROM indicators i
       LEFT JOIN questionnaires q ON i.questionnaire_id = q.id
       LEFT JOIN student_indicators si ON i.id = si.indicator_id
       WHERE i.teacher_id = ?
       GROUP BY i.id`,
      [teacherId]
    );

    console.log(`✅ Se encontraron ${indicators.length} indicadores`);

    res.status(200).json({
      success: true,
      count: indicators.length,
      data: indicators
    });

  } catch (error) {
    console.error('❌ Error en getTeacherIndicators:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al obtener los indicadores',
      error: error.message
    });
  }
};
