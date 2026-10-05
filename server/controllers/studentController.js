import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { syncTeacherStudentData } from '../utils/syncTeacherStudentData.js';
import { logCreate, logUpdate, logDelete } from '../utils/auditLogger.js';
import { notifyLegalConsent } from '../utils/legalConsentNotifications.js';

// Asegurarse de que el directorio de subidas exista
const uploadsDir = path.join(process.cwd(), 'uploads', 'students');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Obtener todos los estudiantes (solo administradores)
export const getStudents = async (req, res) => {
  try {
    // Si llegamos aquí, el middleware isAdmin ya ha verificado que el usuario es administrador
    const query = `
      SELECT 
        s.*, 
        u.email as user_email,
        u.phone as user_phone,
        u.profile_image as user_profile_image,
        u.role, u.id as user_id, u.name as user_name, u.created_at as user_created_at,
        u.estado as user_estado,
        u.institution as user_institution,
        c.institution as course_institution,
        c.name as course_name,
        (
          SELECT GROUP_CONCAT(DISTINCT tu.name ORDER BY tu.name SEPARATOR ', ')
          FROM teacher_students ts
          JOIN teachers t ON t.id = ts.teacher_id
          JOIN users tu ON tu.id = t.user_id
          WHERE ts.student_id = s.id
        ) as teacher_name,
        (
          SELECT GROUP_CONCAT(DISTINCT pa.phase ORDER BY pa.phase SEPARATOR ', ')
          FROM phase_averages pa
          WHERE pa.student_id = s.id
        ) as phases
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      ORDER BY u.name
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

// Estudiantes sin profesor asignado (docente: por sus instituciones; admin/super: todos o filtros)
export const getUnassignedStudents = async (req, res) => {
  try {
    const { institution, grade, course_id } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    let teacherInstitutions = [];
    if (userRole === 'docente') {
      const [teacherRows] = await pool.query(
        'SELECT id, institution FROM teachers WHERE user_id = ?',
        [userId]
      );
      if (teacherRows.length > 0) {
        const teacherId = teacherRows[0].id;
        try {
          const [instRows] = await pool.query(
            `SELECT DISTINCT institution FROM teacher_institutions 
             WHERE teacher_id = ? AND license_status = 'active'`,
            [teacherId]
          );
          teacherInstitutions = (instRows || []).map((r) => r.institution);
        } catch (_) {}
        if (teacherInstitutions.length === 0 && teacherRows[0].institution) {
          teacherInstitutions = [teacherRows[0].institution];
        }
      }
    }

    let query = `
      SELECT DISTINCT
        s.id, s.user_id, s.grade, s.course_id, s.institution,
        u.name, u.email, u.phone,
        c.name as course_name, c.grade as course_grade
      FROM students s
      INNER JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN teacher_students ts ON s.id = ts.student_id
      WHERE ts.student_id IS NULL
    `;
    const params = [];

    if (userRole === 'docente' && teacherInstitutions.length > 0) {
      const placeholders = teacherInstitutions.map(() => '?').join(',');
      query += ` AND (s.institution IN (${placeholders}) OR u.institution IN (${placeholders}))`;
      params.push(...teacherInstitutions, ...teacherInstitutions);
    } else if (institution) {
      query += ` AND (s.institution = ? OR u.institution = ?)`;
      params.push(institution, institution);
    }
    if (grade) {
      query += ` AND s.grade = ?`;
      params.push(grade);
    }
    if (course_id) {
      query += ` AND s.course_id = ?`;
      params.push(course_id);
    }
    query += ` ORDER BY u.name ASC`;

    const [students] = await pool.query(query, params);
    res.json({ success: true, count: students.length, data: students });
  } catch (error) {
    console.error('Error al obtener estudiantes sin profesor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estudiantes sin profesor',
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
        u.institution as user_institution,
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
    institution,  // ✨ AGREGADO: campo institution
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
    institution,  // ✨ AGREGADO: incluir institution en el log
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

    // 2. Obtener el user_id del estudiante y valores antiguos para auditoría
    const [student] = await connection.query(
      `SELECT s.*, u.name as user_name, u.email as user_email, u.phone as user_phone, u.institution
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
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
    
    // Guardar valores antiguos para auditoría
    const oldValues = {
      name: student[0].user_name,
      email: student[0].user_email,
      phone: student[0].user_phone,
      institution: student[0].institution,
      contact_email: student[0].contact_email,
      contact_phone: student[0].contact_phone,
      age: student[0].age,
      grade: student[0].grade,
      course_id: student[0].course_id
    };

    // 3. Actualizar la tabla users (incluyendo institution si existe)
    // Verificar si el campo institution existe en la tabla users
    let hasInstitution = false;
    try {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {
      console.log('⚠️ No se pudo verificar si existe el campo institution:', error);
    }
    
    // Actualizar users con o sin institution según exista el campo
    if (hasInstitution && institution !== undefined) {
      await connection.query(
        'UPDATE users SET name = ?, email = ?, phone = ?, institution = ? WHERE id = ?',
        [name, email, phone, institution || null, userIdToUpdate]
      );
      console.log('✅ Campo institution actualizado en users:', institution || null);
    } else {
      await connection.query(
        'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
        [name, email, phone, userIdToUpdate]
      );
      if (institution !== undefined) {
        console.log('⚠️ El campo institution fue enviado pero no existe en la tabla users');
      }
    }

    // 4. Actualizar la tabla students
    await connection.query(
      `UPDATE students 
       SET contact_email = ?, contact_phone = ?, age = ?, grade = ?, course_id = ? 
       WHERE id = ?`,
      [contact_email, contact_phone, age, grade, course_id, id]
    );

    // 5. Actualizar la relación con el docente si se proporcionó teacher_id
    if (teacher_id) {
      // Verificar que el docente exista (teacher_id es teachers.id)
      const [teacher] = await connection.query(
        'SELECT id FROM teachers WHERE id = ?',
        [teacher_id]
      );

      if (teacher.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'El docente especificado no existe',
          error: 'TEACHER_NOT_FOUND',
          details: `No se encontró un docente con id: ${teacher_id}`
        });
      }

      // Eliminar asignaciones existentes
      await connection.query(
        'DELETE FROM teacher_students WHERE student_id = ?',
        [id]
      );

      // Obtener año académico actual
      const currentAcademicYear = new Date().getFullYear();

      // Crear nueva asignación usando el id de la tabla teachers (incluyendo academic_year)
      await connection.query(
        'INSERT INTO teacher_students (teacher_id, student_id, academic_year) VALUES (?, ?, ?)',
        [teacher_id, id, currentAcademicYear]
      );
    }

    // Confirmar la transacción
    await connection.commit();
    
    // 📝 Registrar en auditoría
    await logUpdate(
      'students',
      parseInt(id),
      req.user.id,
      req.user.role,
      req.user.name || 'Usuario',
      oldValues,
      { name, email, phone, institution, contact_email, contact_phone, age, grade, course_id, teacher_id },
      req
    );
    
    // 🔄 Sincronización automática de datos (institution, academic_year, grade, course_id)
    // Hacerlo después del commit para no afectar la transacción principal
    if (teacher_id) {
      try {
        const currentAcademicYear = new Date().getFullYear();
        await syncTeacherStudentData(teacher_id, id, currentAcademicYear);
        console.log(`✅ Sincronización automática completada en updateStudent`);
      } catch (syncError) {
        console.error('⚠️ Error en sincronización automática (no crítico):', syncError.message);
        // No fallar la actualización si hay error en la sincronización
      }
    }

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

// Crear un nuevo estudiante
export const createStudent = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { 
      name, 
      email, 
      phone, 
      institution,
      contact_phone, 
      contact_email, 
      age, 
      grade, 
      course_id,
      teacher_id
    } = req.body;

    // 1. Crear usuario primero
    const hashedPassword = await bcrypt.hash('password123', 10);
    const [userInstitutionColumn] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'institution'
    `);
    const userInsertColumns = ['name', 'email', 'phone', 'password', 'role'];
    const userInsertValues = [name, email, phone, hashedPassword, 'estudiante'];
    if (userInstitutionColumn.length > 0) {
      userInsertColumns.push('institution');
      userInsertValues.push(institution || null);
    }
    const [userResult] = await connection.query(
      `INSERT INTO users (${userInsertColumns.join(', ')}) VALUES (${userInsertColumns.map(() => '?').join(', ')})`,
      userInsertValues
    );

    const userId = userResult.insertId;
    const isMinor = Number(age) < 18;
    const [consentInsert] = await connection.query(
      `INSERT INTO legal_consents
       (subject_user_id, accepted_by_user_id, created_by_user_id, institution, subject_type, consent_status,
        accepter_relationship, policy_version, purposes, acceptance_method, ip_address, user_agent, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, '1.0', ?, 'institutional_attestation', ?, ?, ?)`,
      [userId, req.user.id, req.user.id, institution || null,
        isMinor ? 'minor_student' : 'adult_student',
        isMinor ? 'pending_guardian' : 'institution_confirmed',
        'usuario institucional que creó el registro',
        JSON.stringify(['gestión de cuenta', 'actividades y seguimiento académico', 'comunicaciones educativas']),
        req.ip, req.get('user-agent') || null,
        isMinor ? 'Pendiente: la institución debe conservar y asociar evidencia de autorización del representante legal.' : 'Creado por un usuario institucional; confirmar entrega de la política al titular.']
    );
    let profileImage = null;

    // Manejar la imagen de perfil si se subió
    if (req.file) {
      profileImage = `/uploads/students/${req.file.filename}`;
    }

    // 2. Crear estudiante
    const [studentInstitutionColumn] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'institution'
    `);
    const studentInsertColumns = ['user_id', 'contact_phone', 'contact_email', 'age', 'grade', 'course_id', 'profile_image'];
    const studentInsertValues = [userId, contact_phone, contact_email, age, grade, course_id, profileImage];
    if (studentInstitutionColumn.length > 0) {
      studentInsertColumns.push('institution');
      studentInsertValues.push(institution || null);
    }
    const [studentResult] = await connection.query(
      `INSERT INTO students (${studentInsertColumns.join(', ')}) VALUES (${studentInsertColumns.map(() => '?').join(', ')})`,
      studentInsertValues
    );

    // 3. Si se especificó un profesor, crear la relación (con academic_year)
    if (teacher_id) {
      const currentAcademicYear = new Date().getFullYear();
      await connection.query(
        'INSERT INTO teacher_students (teacher_id, student_id, academic_year) VALUES (?, ?, ?)',
        [teacher_id, studentResult.insertId, currentAcademicYear]
      );
    }

    await connection.commit();

    let teacherEmail = null;
    if (teacher_id) {
      const [teacherRows] = await pool.query(
        'SELECT u.email FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.id = ?',
        [teacher_id]
      );
      teacherEmail = teacherRows[0]?.email || null;
    }
    const emailNotification = await notifyLegalConsent(consentInsert.insertId, {
      to: [email, isMinor ? contact_email : null, teacherEmail],
      subjectName: name,
      acceptedBy: req.user.email || 'Usuario institucional',
      relationship: isMinor ? 'representante legal pendiente de confirmar; registro institucional' : 'titular adulto; registro institucional',
      institution,
      policyVersion: '1.0',
      status: isMinor ? 'Pendiente de soporte de autorización del representante legal' : 'Constancia institucional registrada'
    });
    
    // 📝 Registrar en auditoría
    await logCreate(
      'students',
      studentResult.insertId,
      req.user.id,
      req.user.role,
      req.user.name || 'Usuario',
      { name, email, institution, age, grade, course_id, teacher_id },
      req
    );
    
    res.status(201).json({
      success: true,
      message: 'Estudiante creado exitosamente',
      notificationStatus: emailNotification.status,
      studentId: studentResult.insertId,
      userId
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear estudiante:', error);
    
    // Eliminar la imagen si se subió pero falló la transacción
    if (req.file) {
      const filePath = path.join(uploadsDir, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Manejar error de correo duplicado
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico ya está en uso',
        error: 'EMAIL_ALREADY_EXISTS'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al crear el estudiante',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Eliminar un estudiante
export const deleteStudent = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    // 1. Obtener datos del estudiante para auditoría
    const [student] = await connection.query(
      `SELECT s.*, u.name as user_name, u.email as user_email, u.phone as user_phone
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    
    if (student.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado',
        error: 'STUDENT_NOT_FOUND'
      });
    }
    
    const userId = student[0].user_id;
    
    // Guardar datos para auditoría antes de eliminar
    const deletedStudentData = {
      name: student[0].user_name,
      email: student[0].user_email,
      phone: student[0].user_phone,
      age: student[0].age,
      grade: student[0].grade,
      course_id: student[0].course_id
    };
    
    // 2. Eliminar el estudiante
    await connection.query('DELETE FROM students WHERE id = ?', [id]);
    
    // 3. Eliminar el usuario
    await connection.query('DELETE FROM users WHERE id = ?', [userId]);
    
    await connection.commit();
    
    // 📝 Registrar en auditoría
    await logDelete(
      'students',
      parseInt(id),
      req.user.id,
      req.user.role,
      req.user.name || 'Usuario',
      deletedStudentData,
      req
    );
    
    res.json({
      success: true,
      message: 'Estudiante eliminado exitosamente'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al eliminar estudiante:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al eliminar el estudiante',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Obtener estadísticas del estudiante
export const getStudentStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener estadísticas básicas
    const [stats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT a.id) as total_attempts,
        AVG(a.score) as average_score,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_attempts,
        COUNT(DISTINCT q.id) as total_quizzes
      FROM students s
      LEFT JOIN attempts a ON a.student_id = s.id
      LEFT JOIN questionnaires q ON q.id = a.questionnaire_id
      WHERE s.id = ?
      GROUP BY s.id
    `, [id]);
    
    // Obtener progreso por fase
    const [phaseProgress] = await pool.query(`
      SELECT 
        q.phase,
        COUNT(DISTINCT q.id) as total_quizzes,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_quizzes,
        AVG(CASE WHEN a.status = 'completed' THEN a.score ELSE NULL END) as average_score
      FROM students s
      LEFT JOIN attempts a ON a.student_id = s.id
      LEFT JOIN questionnaires q ON q.id = a.questionnaire_id
      WHERE s.id = ?
      GROUP BY q.phase
      ORDER BY q.phase
    `, [id]);
    
    res.json({
      success: true,
      data: {
        ...(stats[0] || {}),
        phase_progress: phaseProgress
      }
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas del estudiante:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al obtener estadísticas',
      error: error.message
    });
  }
};
