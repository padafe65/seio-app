import pool from '../config/db.js';

export const createTeacherIfNotExists = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el ID de usuario'
      });
    }

    console.log(`🔍 Verificando si existe profesor con user_id: ${userId}`);
    
    const [existingTeachers] = await pool.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [userId]
    );

    if (existingTeachers && existingTeachers.length > 0) {
      console.log(`✅ Profesor ya existe con ID: ${existingTeachers[0].id}`);
      return res.status(200).json({
        success: true,
        message: 'El profesor ya existe',
        teacher_id: existingTeachers[0].id
      });
    }

    const [users] = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = users[0];

    // --- NUEVA LÓGICA DE SUSCRIPCIÓN ---
    // Definimos 30 días de prueba a partir de hoy
    const fechaInicio = new Date();
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaInicio.getDate() + 30); 
    // ----------------------------------

    // 1. Crear el registro del profesor
    const [result] = await pool.query(
      'INSERT INTO teachers (user_id, subject, institution) VALUES (?, ?, ?)',
      [userId, 'Sin asignar', 'Sin asignar']
    );

    const teacherId = result.insertId;

    // 2. Crear suscripción de prueba (30 días)
    await pool.query(
      "INSERT INTO subscriptions (teacher_id, plan_type, status, current_period_start, current_period_end) VALUES (?, 'monthly', 'active', ?, ?)",
      [teacherId, fechaInicio, fechaVencimiento]
    );

    // 3. Crear registro en teacher_institutions para el Dashboard
    await pool.query(
      "INSERT INTO teacher_institutions (teacher_id, institution, license_status, purchased_date, expiration_date) VALUES (?, ?, 'active', ?, ?)",
      [teacherId, 'Sin asignar', 'active', fechaInicio, fechaVencimiento]
    );

    console.log(`✅ Profesor creado con ID: ${teacherId} y 30 días de prueba.`);

    res.status(201).json({
      success: true,
      message: 'Profesor creado exitosamente con 30 días de prueba',
      teacher_id: teacherId,
      user: user
    });

  } catch (error) {
    console.error('❌ Error en createTeacherIfNotExists:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al crear profesor',
      error: error.message
    });
  }
};

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
    const [teachers] = await pool.query(
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
    const [courses] = await pool.query(
      `SELECT c.* 
       FROM teacher_courses tc
       JOIN courses c ON tc.course_id = c.id
       WHERE tc.teacher_id = ?`,
      [teacher.id]
    );

    // Obtener los estudiantes asignados al profesor
    const [students] = await pool.query(
      `SELECT s.*, u.name, u.email, u.phone, c.name as course_name, c.institution
       FROM teacher_students ts
       JOIN students s ON ts.student_id = s.id
       JOIN users u ON s.user_id = u.id
       LEFT JOIN courses c ON s.course_id = c.id
       WHERE ts.teacher_id = ?`,
      [teacher.id]
    );

    // Obtener los cuestionarios creados por el profesor
    const [questionnaires] = await pool.query(
      `SELECT * FROM questionnaires WHERE created_by = ?`,
      [teacher.id]
    );

    // Obtener los indicadores creados por el profesor
    const [indicators] = await pool.query(
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
    const [teacher] = await pool.query(
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
      const [requestingTeacher] = await pool.query(
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
        AND (ts.academic_year = ? OR ts.academic_year IS NULL)
      ORDER BY u.name ASC
    `;
    
    // Obtener año académico actual para filtrar
    const currentAcademicYear = new Date().getFullYear();
    
    console.log('\n📝 Ejecutando consulta SQL:');
    console.log(query);
    console.log('📌 Parámetros:', [teacherId, grade, currentAcademicYear]);
    
    console.log('\n🔍 Verificando datos en la base de datos...');
    
    // Verificar si el docente existe
    const [teacherCheck] = await pool.query('SELECT id FROM teachers WHERE id = ?', [teacherId]);
    console.log(`👨‍🏫 Docente con ID ${teacherId} existe:`, teacherCheck.length > 0 ? 'Sí' : 'No');
    
    // Verificar si hay estudiantes asignados al docente
    const [assignedStudents] = await pool.query(
      'SELECT COUNT(*) as count FROM teacher_students WHERE teacher_id = ?', 
      [teacherId]
    );
    console.log(`📊 Total de estudiantes asignados al docente: ${assignedStudents[0].count}`);
    
    // Verificar si hay estudiantes en el grado especificado
    const [gradeStudents] = await pool.query(
      'SELECT COUNT(*) as count FROM students WHERE grade = ?', 
      [grade]
    );
    console.log(`📊 Total de estudiantes en el grado ${grade}: ${gradeStudents[0].count}`);
    
    // Ejecutar la consulta principal (con academic_year)
    const [students] = await pool.query(query, [teacherId, grade, currentAcademicYear]);
    
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
    const [teachers] = await pool.query(
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
    const [indicators] = await pool.query(
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

export const getStudentProgressByQuestionnaire = async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`🔍 Obteniendo progreso de estudiantes para cuestionario ${questionnaireId}`);

    if (!questionnaireId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el ID del cuestionario'
      });
    }

    // Verificar que el cuestionario existe
    const [questionnaires] = await pool.query(
      'SELECT * FROM questionnaires WHERE id = ?',
      [questionnaireId]
    );

    if (!questionnaires || questionnaires.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el cuestionario'
      });
    }

    const questionnaire = questionnaires[0];

    // Si es docente, verificar que el cuestionario le pertenezca
    if (userRole === 'docente') {
      const teacherId = req.user.teacher_id;
      
      console.log(`🔍 Docente autenticado: user_id=${userId}, teacher_id=${teacherId}`);
      console.log(`🔍 Cuestionario solicitado: created_by=${questionnaire.created_by}, questionnaire_id=${questionnaireId}`);
    
      // Mostrar todos los cuestionarios del docente para diagnóstico
      const [teacherQuestionnaires] = await pool.query(
        'SELECT id, title FROM questionnaires WHERE created_by = ?',
        [teacherId]
      );
      console.log(`📋 Cuestionarios del docente ${teacherId}:`, teacherQuestionnaires.map(q => `ID:${q.id} - ${q.title}`));

      if (!teacherId) {
        console.log('❌ teacher_id no encontrado en el middleware');
        return res.status(403).json({
          success: false,
          message: 'Teacher ID no encontrado'
        });
      }

      if (teacherId !== questionnaire.created_by) {
        console.log(`❌ Sin permiso: teacherId=${teacherId} != questionnaire.created_by=${questionnaire.created_by}`);
        return res.status(403).json({
          success: false,
          message: `No tienes permiso para ver este cuestionario. El cuestionario ID=${questionnaireId} fue creado por teacher_id=${questionnaire.created_by}, pero tu teacher_id es ${teacherId}. Por favor selecciona un cuestionario que te pertenezca.`
        });
      }

      console.log('✅ Permisos validados correctamente');
    }

    // Obtener el progreso de los estudiantes
    const [progress] = await pool.query(
      `SELECT 
        s.id as student_id,
        u.name as student_name,
        u.email as email,
        qs.id as session_id,
        qs.status as status,
        qs.attempt_number as attempt_number,
        qs.started_at as session_started,
        JSON_LENGTH(qs.answers_json) as answered_questions,
        (SELECT COUNT(*) FROM questions WHERE questionnaire_id = ?) as total_questions,
        CASE 
          WHEN qs.status = 'submitted' THEN 
            -- Aquí podrías calcular el puntaje real basado en las respuestas si fuera necesario
            -- Por ahora usaremos un valor de ejemplo o lo que esté en la sesión
            5.0 -- Ejemplo de puntaje
          ELSE NULL
        END as score,
        CASE 
          WHEN JSON_LENGTH(qs.answers_json) > 0 AND (SELECT COUNT(*) FROM questions WHERE questionnaire_id = ?) > 0 THEN 
            ROUND(JSON_LENGTH(qs.answers_json) * 100.0 / (SELECT COUNT(*) FROM questions WHERE questionnaire_id = ?), 2)
          ELSE 0
        END as progress_percentage
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN teacher_students ts ON s.id = ts.student_id
       LEFT JOIN quiz_sessions qs ON s.id = qs.student_id AND qs.questionnaire_id = ?
       WHERE ts.teacher_id = ?
       GROUP BY s.id, u.name, u.email, qs.id, qs.status, qs.attempt_number, qs.started_at, qs.answers_json
       ORDER BY u.name ASC`,
      [questionnaireId, questionnaireId, questionnaireId, questionnaireId, userRole === 'docente' ? req.user.teacher_id : questionnaire.created_by]
    );

    res.status(200).json({
      success: true,
      data: progress,
      questionnaire: {
        id: questionnaire.id,
        title: questionnaire.title,
        total_questions: progress.length > 0 ? progress[0].total_questions : 0
      }
    });

  } catch (error) {
    console.error('❌ Error en getStudentProgressByQuestionnaire:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al obtener el progreso de estudiantes',
      error: error.message
    });
  }
};

/*export const getTeacherSessions = async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el ID del profesor'
      });
    }

    const [sessions] = await pool.query(
      `SELECT 
        qs.*, 
        u.name as student_name, 
        q.title as questionnaire_title
       FROM quiz_sessions qs
       JOIN students s ON qs.student_id = s.id
       JOIN users u ON s.user_id = u.id
       JOIN teacher_students ts ON s.id = ts.student_id
       JOIN questionnaires q ON qs.questionnaire_id = q.id
       WHERE ts.teacher_id = ?
       ORDER BY qs.started_at DESC`,
      [teacherId]
    );

    res.status(200).json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('❌ Error en getTeacherSessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las sesiones del profesor',
      error: error.message
    });
  }
};*/

export const getAllSessionsByRole = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    let query = `
      SELECT 
        qs.*, 
        u.name as student_name, 
        q.title as questionnaire_title
      FROM quiz_sessions qs
      JOIN students s ON qs.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN questionnaires q ON qs.questionnaire_id = q.id
      LEFT JOIN teacher_students ts ON s.id = ts.student_id
    `;

    let params = [];

    // 🧑‍🏫 Si es docente → solo sus estudiantes
    if (role === 'docente') {
      const [teacher] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [userId]
      );

      if (!teacher.length) {
        return res.status(403).json({
          success: false,
          message: 'Docente no encontrado'
        });
      }

      query += ` WHERE ts.teacher_id = ?`;
      params.push(teacher[0].id);
    }

    // 👑 Si es admin o super_admin → ve TODO
    query += ` ORDER BY qs.started_at DESC`;

    const [sessions] = await pool.query(query, params);

    res.status(200).json({
      success: true,
      data: sessions
    });

  } catch (error) {
    console.error('❌ Error obteniendo sesiones:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo sesiones'
    });
  }
};


//Reopen la sesion de evaluación para que el estudiante pueda volver a responder el cuestionario
export const reopenSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el ID de la sesión'
      });
    }

    await pool.query(`
      UPDATE quiz_sessions
      SET 
        status = 'in_progress',
        expires_at = NULL
      WHERE id = ?
    `, [sessionId]);

    res.status(200).json({
      success: true,
      message: 'Sesión reabierta correctamente'
    });

  } catch (error) {
    console.error('Error reabriendo sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reabrir sesión'
    });
  }
};

// controllers/teacherController.js

export const updateSession = async (req, res) => {
  const { sessionId } = req.params;
  const { role, id: userId } = req.user;

  if (!['docente', 'administrador', 'super_admin'].includes(role)) {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para actualizar sesiones'
    });
  }

  const {
    status,
    started_at,
    expires_at,
    answers_json,
    question_ids_json,
    attempt_number,
    academic_year
  } = req.body;

  try {

    // 🔎 VALIDAR FECHAS Y DURACIÓN
    if (started_at && expires_at) {
      const start = new Date(started_at);
      const end = new Date(expires_at);

      if (end <= start) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de finalización no puede ser menor o igual a la fecha de inicio'
        });
      }

      // Obtener duración permitida del cuestionario
      const [sessionData] = await pool.query(
        `SELECT q.time_limit_minutes
         FROM quiz_sessions qs
         JOIN questionnaires q ON qs.questionnaire_id = q.id
         WHERE qs.id = ?`,
        [sessionId]
      );

      if (sessionData.length) {
        const timeLimit = sessionData[0].time_limit_minutes;

        if (timeLimit) {
          const diffMinutes = (end - start) / (1000 * 60);

          if (diffMinutes > timeLimit) {
            return res.status(400).json({
              success: false,
              message: `La duración no puede superar los ${timeLimit} minutos definidos para esta evaluación`
            });
          }
        }
      }
    }

    // 🧑‍🏫 Validar que docente solo edite sus estudiantes
    if (role === 'docente') {
      const [teacher] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [userId]
      );

      if (!teacher.length) {
        return res.status(403).json({
          success: false,
          message: 'Docente no encontrado'
        });
      }

      const teacherId = teacher[0].id;

      const [sessionCheck] = await pool.query(
        `SELECT qs.id
         FROM quiz_sessions qs
         JOIN teacher_students ts ON qs.student_id = ts.student_id
         WHERE qs.id = ? AND ts.teacher_id = ?`,
        [sessionId, teacherId]
      );

      if (!sessionCheck.length) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar esta sesión'
        });
      }
    }

    // 👑 Admin y super_admin pueden modificar cualquiera

    await pool.query(
      `UPDATE quiz_sessions
       SET 
         status = ?,
         started_at = ?,
         expires_at = ?,
         attempt_number = ?,
         academic_year = ?,
         answers_json = ?,
         question_ids_json = ?,
         updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [
        status,
        started_at,
        expires_at,
        attempt_number,
        academic_year,
        answers_json,
        question_ids_json,
        sessionId
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Sesión actualizada correctamente'
    });

  } catch (err) {
    console.error('Error actualizando sesión:', err);

    const message =
        err.response?.data?.message ||
        'Error al actualizar la sesión';

    alert(message);
}

};
