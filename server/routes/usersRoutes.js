// routes/usersRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin, isSuperAdmin } from '../middleware/authMiddleware.js';
import bcrypt from 'bcrypt';
import { logCreate, logUpdate, logDelete } from '../utils/auditLogger.js';
import uploadProfileImage from '../middleware/uploadProfileImage.js';
import { isValidPassword, PASSWORD_REQUIREMENTS } from '../utils/passwordPolicy.js';
import { notifyLegalConsent } from '../utils/legalConsentNotifications.js';

const router = express.Router();

// Middleware para verificar si el usuario es administrador o super_administrador
const isAdminOrSuperAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'administrador' || req.user.role === 'super_administrador')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Acceso denegado. Se requieren privilegios de administrador o super administrador.',
    code: 'ADMIN_ACCESS_REQUIRED',
    userRole: req.user?.role
  });
};

// Función para validar permisos de asignación de roles
const validateRoleAssignment = (userRole, assignedRole) => {
  // Super administrador puede asignar todos los roles
  if (userRole === 'super_administrador') {
    return true;
  }
  
  // Administrador solo puede asignar 'estudiante' y 'docente'
  if (userRole === 'administrador') {
    return assignedRole === 'estudiante' || assignedRole === 'docente';
  }
  
  return false;
};

// Aplicar verificación de token a todas las rutas
router.use(verifyToken);

// 🔐 GET: Obtener datos del usuario autenticado (perfil actual)
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Obtener datos básicos del usuario
    const [user] = await pool.query(
      `SELECT id, name, email, phone, institution, role, profile_image, estado, created_at FROM users WHERE id = ?`,
      [userId]
    );

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    let userData = { ...user[0] };

    // Si es docente, obtener también institución de teachers
    if (userRole === 'docente') {
      try {
        const [teachers] = await pool.query(
          'SELECT id, institution FROM teachers WHERE user_id = ?',
          [userId]
        );
        if (teachers.length > 0 && teachers[0].institution) {
          userData.institution = teachers[0].institution;
        }
      } catch (error) {
        console.warn('⚠️ Error obteniendo datos de teachers:', error.message);
      }
    }

    // Si es estudiante, obtener también institución de students
    if (userRole === 'estudiante') {
      try {
        const [students] = await pool.query(
          'SELECT id, institution FROM students WHERE user_id = ?',
          [userId]
        );
        if (students.length > 0 && students[0].institution) {
          userData.institution = students[0].institution;
        }
      } catch (error) {
        console.warn('⚠️ Error obteniendo datos de students:', error.message);
      }
    }

    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Error al obtener perfil del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil',
      error: error.message
    });
  }
});

// Obtener todos los usuarios (administrador y super_administrador)
router.get('/users', isAdminOrSuperAdmin, async (req, res) => {
  try {
    // Verificar si la columna institution existe antes de incluirla
    let institutionField = '';
    try {
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      if (columns.length > 0) {
        institutionField = ', institution';
      }
    } catch (error) {
      // Si hay error, simplemente no incluir institution
      console.log('⚠️ Campo institution no disponible aún, ejecuta la migración SQL');
    }
    
    // Si es administrador (no super), filtrar para que solo vea estudiantes y docentes
    let roleFilter = '';
    if (req.user.role === 'administrador') {
      roleFilter = " AND u.role IN ('estudiante', 'docente')";
    }
    
// 💡 CAMBIO CLAVE: Hacemos JOIN con la tabla teachers para traer 'subject' y el 'teacher_id'
    const [users] = await pool.query(
      `SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.phone, 
        u.role, 
        u.institution,
        t.id as teacher_id, 
        t.subject,
        CASE 
          WHEN u.estado = 'activo' THEN 1 
          ELSE 0 
        END as estado
      FROM users u
      LEFT JOIN teachers t ON u.id = t.user_id
      WHERE 1=1 ${roleFilter}
      ORDER BY u.created_at DESC`
    );
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message
    });
  }
});

// Obtener un usuario por ID (administrador y super_administrador)
router.get('/users/:id/legal-consents', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, subject_user_id, accepted_by_user_id, created_by_user_id, institution, subject_type,
              consent_status, accepter_name, accepter_relationship, guardian_email, guardian_phone,
              policy_version, policy_sha256, purposes, acceptance_method, accepted_at, revoked_at,
              ip_address, user_agent, notes, created_at
       FROM legal_consents WHERE subject_user_id = ? ORDER BY created_at DESC, id DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al consultar autorizaciones:', error);
    res.status(500).json({ success: false, message: 'No se pudo consultar el historial de autorizaciones.' });
  }
});

// Historial global, reservado al superadministrador.
router.get('/legal-consents', isSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT lc.*, su.name AS subject_name, su.email AS subject_email, su.role AS subject_role,
              st.age AS student_age, st.contact_email AS student_contact_email,
              accepter.name AS accepter_account_name, creator.name AS creator_name,
              teacher_info.teacher_names, teacher_info.teacher_emails
       FROM legal_consents lc
       JOIN users su ON su.id = lc.subject_user_id
       LEFT JOIN students st ON st.user_id = su.id
       LEFT JOIN users accepter ON accepter.id = lc.accepted_by_user_id
       LEFT JOIN users creator ON creator.id = lc.created_by_user_id
       LEFT JOIN (
         SELECT ts.student_id,
                GROUP_CONCAT(DISTINCT tu.name ORDER BY tu.name SEPARATOR ', ') AS teacher_names,
                GROUP_CONCAT(DISTINCT tu.email ORDER BY tu.email SEPARATOR ',') AS teacher_emails
         FROM teacher_students ts
         JOIN teachers t ON t.id = ts.teacher_id
         JOIN users tu ON tu.id = t.user_id
         GROUP BY ts.student_id
       ) teacher_info ON teacher_info.student_id = st.id
       ORDER BY lc.created_at DESC, lc.id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al consultar historial global de autorizaciones:', error);
    res.status(500).json({ success: false, message: 'No se pudo consultar el historial de autorizaciones.' });
  }
});

router.get('/users/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si la columna institution existe
    let institutionField = '';
    try {
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      if (columns.length > 0) {
        institutionField = ', institution';
      }
    } catch (error) {
      // Ignorar error
    }
    
// 🛠️ CAMBIO EN BACKEND: JOIN para traer nombre del creador
    const [users] = await pool.query(
      `SELECT 
        u.id, u.name, u.email, u.phone, u.role, u.profile_image, u.institution, u.created_by,
        c.name as creator_name, 
        c.role as creator_role,
        CASE 
          WHEN u.estado IS NULL THEN 1
          WHEN u.estado = 'activo' THEN 1
          WHEN u.estado = 'pendiente' THEN 0
          WHEN u.estado = 'suspendido' THEN 0
          ELSE 1
        END as estado,
        u.created_at 
      FROM users u
      LEFT JOIN users c ON u.created_by = c.id 
      WHERE u.id = ?`,
      [id]
    );    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario',
      error: error.message
    });
  }
});

// Crear un nuevo usuario (administrador o super_administrador)
router.post('/users', isAdminOrSuperAdmin, async (req, res) => {
  try {
    // 1. Capturar el ID del que está creando (Admin/Docente)
    const creatorId = req.user ? req.user.id : null;
    const { name, email, phone, password, role, institution, course_name, grade, legalConsent, guardianApprovalConfirmed } = req.body;
    const userRole = req.user.role; // Rol del usuario que está creando
    
    // Validar campos requeridos
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: name, email, password, role'
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ success: false, message: PASSWORD_REQUIREMENTS });
    }
    if (!legalConsent) {
      return res.status(400).json({ success: false, message: 'Debes confirmar que la persona recibió la política de tratamiento de datos.' });
    }
    if (role === 'estudiante' && !guardianApprovalConfirmed) {
      return res.status(400).json({ success: false, message: 'Antes de crear el estudiante, confirma que verificaste si es menor de edad y que cuentas con la autorización requerida de su representante legal.' });
    }
    
    // Validar que el rol sea válido
    const validRoles = ['estudiante', 'docente', 'administrador', 'super_administrador'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Rol inválido. Los roles válidos son: ${validRoles.join(', ')}`
      });
    }
    
    // 🔒 Validar permisos: administrador solo puede asignar estudiante/docente
    if (!validateRoleAssignment(userRole, role)) {
      return res.status(403).json({
        success: false,
        message: `No tienes permisos para asignar el rol '${role}'.`,
        code: 'ROLE_ASSIGNMENT_DENIED',
        yourRole: userRole,
        attemptedRole: role
      });
    }
    
    // Verificar si el usuario ya existe
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR name = ?',
      [email, name]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este email o nombre'
      });
    }
    
    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Verificar si la columna institution existe
    let hasInstitution = false;
    try {
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {}
    
    // --- 🛠️ MODIFICACIÓN: INSERTAR PRIMERO PARA OBTENER EL ID ---
    let insertQuery, insertValues;
    if (hasInstitution) {
      insertQuery = 'INSERT INTO users (name, email, phone, password, role, estado, institution, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      insertValues = [name, email, phone || null, hashedPassword, role, 'activo', institution || null, creatorId];
    } else {
      insertQuery = 'INSERT INTO users (name, email, phone, password, role, estado, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)';
      insertValues = [name, email, phone || null, hashedPassword, role, 'activo', creatorId];
    }

    const [result] = await pool.query(insertQuery, insertValues);
    const newUserId = result.insertId;

    const [consentInsert] = await pool.query(
      `INSERT INTO legal_consents
       (subject_user_id, accepted_by_user_id, created_by_user_id, institution, subject_type, consent_status,
        accepter_name, accepter_relationship, policy_version, purposes, acceptance_method, accepted_at,
        ip_address, user_agent, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1.0', ?, 'institutional_attestation', NOW(), ?, ?, ?)`,
      [newUserId, creatorId, creatorId, institution || null,
        role === 'estudiante' ? 'student_unknown' : role === 'docente' ? 'teacher' : 'other',
        'institution_confirmed',
        req.user.name || null, role === 'estudiante' ? 'confirmación del usuario creador; no sustituye el soporte de autorización familiar' : 'creador institucional',
        JSON.stringify(['gestión de cuenta', 'actividades y seguimiento académico', 'comunicaciones educativas']),
        req.ip, req.get('user-agent') || null,
        role === 'estudiante' ? 'El creador declara haber informado y verificado la autorización aplicable del representante legal. Conservar el soporte en la institución.' : 'El usuario creador confirma haber puesto la política a disposición del titular.']
    );

    const [creatorRows] = creatorId
      ? await pool.query('SELECT name, email FROM users WHERE id = ?', [creatorId])
      : [[]];
    const emailNotification = await notifyLegalConsent(consentInsert.insertId, {
      to: [email, creatorRows[0]?.email],
      subjectName: name,
      acceptedBy: creatorRows[0]?.name || 'Usuario institucional',
      relationship: role === 'estudiante' ? 'usuario institucional que registró la verificación' : 'usuario que puso la política a disposición',
      institution,
      policyVersion: '1.0',
      status: role === 'estudiante' ? 'Confirmación institucional; verificar soporte familiar' : 'Constancia institucional registrada'
    });

    // --- 🛠️ MODIFICACIÓN: LÓGICA DE AUTOREGISTRO (Ahora con newUserId definido) ---
    if (!creatorId) {
      await pool.query(
        'UPDATE users SET created_by = ?, updated_by = ? WHERE id = ?',
        [newUserId, newUserId, newUserId]
      );
    }
    
    // >>> INICIO DE LA AUTOMATIZACIÓN PARA DOCENTES <<<
    if (role === 'docente' && institution && course_name) {
      try {
        const [teacherRes] = await pool.query(
          'INSERT INTO teachers (user_id, institution, subject) VALUES (?, ?, ?)',
          [newUserId, institution, course_name]
        );
        const newTeacherId = teacherRes.insertId;

        const [existingCourse] = await pool.query(
          "SELECT id FROM courses WHERE name = ? AND institution = ?",
          [course_name, institution]
        );

        let courseId;
        if (existingCourse.length === 0) {
          const [newCourse] = await pool.query(
            "INSERT INTO courses (name, grade, institution, teacher_id, created_by) VALUES (?, ?, ?, ?, ?)",
            [course_name, grade || 'N/A', institution, newTeacherId, creatorId || newUserId]
          );
          courseId = newCourse.insertId;
        } else {
          courseId = existingCourse[0].id;
        }

        await pool.query(
          "INSERT IGNORE INTO teacher_courses (teacher_id, course_id, assigned_date, role) VALUES (?, ?, NOW(), ?)",
          [newTeacherId, courseId, 'principal']
        );
      } catch (autoError) {
        console.error('⚠️ Error en la automatización de curso:', autoError.message);
      }
    }
    
    // 📝 Registrar en auditoría
    await logCreate(
      'users',
      newUserId,
      creatorId,
      userRole,
      req.user.name || 'Usuario',
      { name, email, role, institution, course_name },
      req
    ); 

    // Obtener el usuario creado para la respuesta
    const [newUser] = await pool.query(
      `SELECT id, name, email, phone, role ${hasInstitution ? ', institution' : ''}, estado, created_by FROM users WHERE id = ?`,
      [newUserId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      notificationStatus: emailNotification.status,
      data: newUser[0]
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message
    });
  }
});
// Actualizar un usuario (administrador o super_administrador)
router.put('/users/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Al principio del método, captura quién edita:
    const updaterId = req.user.id;
    // ✨ SE AGREGÓ: course_name y grade a la desestructuración del body
    // 🛠️ ADICIÓN: Se extrae created_by del body para permitir su actualización
    const { name, email, phone, role, estado, password, institution, course_name, grade, created_by } = req.body;
    const userRole = req.user.role; // Rol del usuario que está haciendo la actualización
    
    // Verificar que el usuario existe
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    const targetUser = existingUsers[0];
    
    // 🔒 Validar permisos: administrador no puede editar otros administradores o super_administradores
    if (userRole === 'administrador' && 
        (targetUser.role === 'administrador' || targetUser.role === 'super_administrador')) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar usuarios con rol de administrador o super administrador.',
        code: 'INSUFFICIENT_PERMISSIONS',
        yourRole: userRole,
        targetRole: targetUser.role
      });
    }
    
    // Si se proporciona un nuevo email, verificar que no esté en uso por otro usuario
    if (email && email !== existingUsers[0].email) {
      const [emailUsers] = await pool.query(
        'SELECT * FROM users WHERE email = ? AND id != ?',
        [email, id]
      );
      
      if (emailUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está en uso por otro usuario'
        });
      }
    }
    
    // Si se proporciona un nuevo nombre, verificar que no esté en uso por otro usuario
    if (name && name !== existingUsers[0].name) {
      const [nameUsers] = await pool.query(
        'SELECT * FROM users WHERE name = ? AND id != ?',
        [name, id]
      );
      
      if (nameUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'El nombre ya está en uso por otro usuario'
        });
      }
    }
    
    // Validar rol si se proporciona (con verificación de permisos)
    if (role) {
      const validRoles = ['estudiante', 'docente', 'administrador', 'super_administrador'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Rol inválido. Los roles válidos son: ${validRoles.join(', ')}`
        });
      }
      
      // 🔒 Validar permisos: administrador solo puede asignar estudiante/docente
      if (!validateRoleAssignment(userRole, role)) {
        return res.status(403).json({
          success: false,
          message: `No tienes permisos para asignar el rol '${role}'. Los administradores solo pueden asignar roles de 'estudiante' o 'docente'.`,
          code: 'ROLE_ASSIGNMENT_DENIED',
          yourRole: userRole,
          attemptedRole: role
        });
      }
    }
    
    // Construir query de actualización dinámicamente
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }

    // 🛠️ ADICIÓN: Permite actualizar el campo created_by si viene en el body
    if (created_by !== undefined) {
      updates.push('created_by = ?');
      values.push(created_by);
    }
    
    // Verificar si la columna institution existe antes de actualizarla
    let hasInstitution = false;
    try {
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    if (institution !== undefined && hasInstitution) {
      updates.push('institution = ?');
      values.push(institution || null);
    }
    
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (estado !== undefined) {
      let estadoValue;
      if (typeof estado === 'number') {
        estadoValue = estado === 1 ? 'activo' : 'pendiente';
      } else if (typeof estado === 'string') {
        const estadoLower = estado.toLowerCase();
        if (estadoLower === 'activo' || estadoLower === 'pendiente' || estadoLower === 'suspendido') {
          estadoValue = estadoLower;
        } else if (estadoLower === 'inactivo') {
          estadoValue = 'pendiente';
        } else if (estado === '1' || estado === 1) {
          estadoValue = 'activo';
        } else if (estado === '0' || estado === 0) {
          estadoValue = 'pendiente';
        } else {
          estadoValue = 'activo';
        }
      } else {
        estadoValue = estado ? 'activo' : 'pendiente';
      }
      updates.push('estado = ?');
      values.push(estadoValue);
    }

    if (password !== undefined && password !== '') {
      return res.status(403).json({
        success: false,
        message: 'No se puede cambiar la contraseña desde aquí. Usa el sistema de recuperación de contraseña en /reset-password'
      });
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }
    
    values.push(id);
    
    // Guardar valores antiguos para auditoría
    const oldValues = {
      name: existingUsers[0].name,
      email: existingUsers[0].email,
      phone: existingUsers[0].phone,
      role: existingUsers[0].role,
      estado: existingUsers[0].estado,
      institution: existingUsers[0].institution
    };
    
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // ✨ AGREGADO: LÓGICA DE ACTUALIZACIÓN/CREACIÓN DE CURSO PARA DOCENTES
    if ((role === 'docente' || targetUser.role === 'docente') && institution && course_name) {
      try {
        const [teacherCheck] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [id]);
        let teacherId;
        if (teacherCheck.length === 0) {
          const [tRes] = await pool.query('INSERT INTO teachers (user_id, institution, subject) VALUES (?, ?, ?)', [id, institution, course_name]);
          teacherId = tRes.insertId;
        } else {
          teacherId = teacherCheck[0].id;
          await pool.query('UPDATE teachers SET institution = ? WHERE id = ?', [institution, teacherId]);
        }

        const [existingCourse] = await pool.query(
          "SELECT id FROM courses WHERE name = ? AND institution = ?",
          [course_name, institution]
        );

        let finalCourseId;
        if (existingCourse.length === 0) {
          const [newC] = await pool.query(
            "INSERT INTO courses (name, grade, institution, teacher_id, created_by) VALUES (?, ?, ?, ?, ?)",
            [course_name, grade || 'N/A', institution, teacherId, req.user.id]
          );
          finalCourseId = newC.insertId;
        } else {
          finalCourseId = existingCourse[0].id;
        }

        await pool.query(
          "INSERT IGNORE INTO teacher_courses (teacher_id, course_id, assigned_date, role) VALUES (?, ?, NOW(), 'principal')",
          [teacherId, finalCourseId]
        );
      } catch (autoErr) {
        console.error('⚠️ Error actualizando curso en edición:', autoErr.message);
      }
    }
    
    // 📝 Registrar en auditoría
    await logUpdate(
      'users',
      parseInt(id),
      req.user.id,
      req.user.role,
      req.user.name || 'Usuario',
      oldValues,
      { name, email, phone, role, estado, institution, course_name },
      req
    );
    
    // Obtener el usuario actualizado para el response
    let institutionField = '';
    try {
      const [columns] = await pool.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'institution'`);
      if (columns.length > 0) institutionField = ', institution';
    } catch (error) {}
    
    const [updatedUser] = await pool.query(
      `SELECT id, name, email, phone, role${institutionField},
              CASE 
                WHEN estado = 'activo' THEN 1
                WHEN estado = 'pendiente' THEN 0
                WHEN estado = 'suspendido' THEN 0
                ELSE 1
              END as estado,
              created_at 
       FROM users 
       WHERE id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: updatedUser[0]
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message
    });
  }
});
// Eliminar un usuario (administrador y super_administrador con restricciones)
router.delete('/users/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // No permitir eliminarse a sí mismo
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta'
      });
    }
    
    // Verificar que el usuario existe
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    const targetUser = existingUsers[0];
    
    // Validar permisos: administrador no puede eliminar otros administradores o super_administradores
    if (req.user.role === 'administrador' && 
        (targetUser.role === 'administrador' || targetUser.role === 'super_administrador')) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar usuarios con rol de administrador o super administrador.',
        code: 'INSUFFICIENT_PERMISSIONS',
        yourRole: req.user.role,
        targetRole: targetUser.role
      });
    }
    
    // Guardar valores para auditoría antes de eliminar
    const deletedUserData = {
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      institution: targetUser.institution
    };
    
    // Eliminar el usuario
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    
    // 📝 Registrar en auditoría
    await logDelete(
      'users',
      parseInt(id),
      req.user.id,
      req.user.role,
      req.user.name || 'Usuario',
      deletedUserData,
      req
    );
    
    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario',
      error: error.message
    });
  }
});

// 📸 POST: Subir imagen de perfil del usuario autenticado
router.post('/upload-profile-image', uploadProfileImage.single('profileImage'), async (req, res) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Debe estar autenticado para subir imagen'
      });
    }

    // Verificar que se haya subido un archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó archivo de imagen'
      });
    }

    // Construir la ruta relativa de la imagen
    const profileImagePath = `/uploads/profile-images/${req.file.filename}`;

    // Actualizar el perfil del usuario con la nueva imagen
    const [result] = await pool.query(
      'UPDATE users SET profile_image = ? WHERE id = ?',
      [profileImagePath, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // 📝 Registrar en auditoría
    await logUpdate(
      'users',
      req.user.id,
      req.user.id,
      req.user.role,
      req.user.name || 'Usuario',
      { profile_image: 'sin imagen anterior' },
      { profile_image: profileImagePath },
      req
    );

    res.json({
      success: true,
      message: 'Imagen de perfil subida exitosamente',
      data: {
        profileImage: profileImagePath,
        fileName: req.file.filename
      }
    });
  } catch (error) {
    console.error('Error al subir imagen de perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir imagen de perfil',
      error: error.message
    });
  }
});

// ✏️ PUT: Actualizar perfil del usuario
router.put('/update-profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, institution } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validar que al menos un campo sea proporcionado
    if (!name && !phone && !institution) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un campo para actualizar'
      });
    }

    // Obtener datos actuales para auditoría
    const [currentUser] = await pool.query('SELECT name, phone, institution, role FROM users WHERE id = ?', [userId]);

    if (currentUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const currentUserData = currentUser[0];

    // Construir query dinámica para tabla users
    let updateFields = [];
    let updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (institution !== undefined) {
      updateFields.push('institution = ?');
      updateValues.push(institution);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(userId);

    // Actualizar tabla users
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    const [result] = await pool.query(query, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Si es docente, también actualizar la tabla teachers
    if (userRole === 'docente' && institution !== undefined) {
      try {
        const [teachers] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [userId]);
        if (teachers.length > 0) {
          await pool.query(
            'UPDATE teachers SET institution = ?, updated_at = NOW() WHERE user_id = ?',
            [institution, userId]
          );
        }
      } catch (error) {
        console.warn('⚠️ No se pudo actualizar institución en tabla teachers:', error.message);
      }
    }

    // Si es estudiante, también actualizar la tabla students
    if (userRole === 'estudiante' && institution !== undefined) {
      try {
        const [students] = await pool.query('SELECT id FROM students WHERE user_id = ?', [userId]);
        if (students.length > 0) {
          await pool.query(
            'UPDATE students SET institution = ?, updated_at = NOW() WHERE user_id = ?',
            [institution, userId]
          );
        }
      } catch (error) {
        console.warn('⚠️ No se pudo actualizar institución en tabla students:', error.message);
      }
    }

    // Obtener datos actualizados de todas las fuentes según el rol
    let updatedUserData = {};
    
    const [usersData] = await pool.query(
      `SELECT id, name, email, phone, institution, role, profile_image, estado, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    updatedUserData = usersData[0];

    // Si es docente, obtener también datos de teachers
    if (userRole === 'docente') {
      const [teachersData] = await pool.query(
        'SELECT id, institution FROM teachers WHERE user_id = ?',
        [userId]
      );
      if (teachersData.length > 0 && teachersData[0].institution) {
        updatedUserData.institution = teachersData[0].institution;
      }
    }

    // Si es estudiante, obtener también datos de students
    if (userRole === 'estudiante') {
      const [studentsData] = await pool.query(
        'SELECT id, institution FROM students WHERE user_id = ?',
        [userId]
      );
      if (studentsData.length > 0 && studentsData[0].institution) {
        updatedUserData.institution = studentsData[0].institution;
      }
    }

    // 📝 Registrar en auditoría
    const oldValues = {
      name: currentUserData.name,
      phone: currentUserData.phone,
      institution: currentUserData.institution
    };
    const newValues = {
      name: name || oldValues.name,
      phone: phone || oldValues.phone,
      institution: institution || oldValues.institution
    };

    await logUpdate(
      'users',
      userId,
      req.user.id,
      req.user.role,
      req.user.name || 'Usuario',
      oldValues,
      newValues,
      req
    );

    res.json(updatedUserData);
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil',
      error: error.message
    });
  }
});

// 🔐 PUT: Cambiar contraseña del usuario
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    // Validar que los campos requeridos estén presentes
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar contraseña actual, nueva contraseña y confirmación'
      });
    }

    // Validar que las nuevas contraseñas coincidan
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Las contraseñas nuevas no coinciden'
      });
    }

    // Validar longitud mínima de la nueva contraseña
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_REQUIREMENTS
      });
    }

    // Validar que la nueva contraseña sea diferente a la actual
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña no puede ser igual a la actual'
      });
    }

    // Obtener usuario actual con su contraseña hasheada
    const [users] = await pool.query(
      'SELECT id, password FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = users[0];

    // Validar que la contraseña actual sea correcta
    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Hash la nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña en la BD
    await pool.query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedNewPassword, userId]
    );

    // 📝 Registrar en auditoría
    await logUpdate(
      'users',
      userId,
      userId,
      req.user.role,
      req.user.name || 'Usuario',
      { password: 'oculta' },
      { password: 'actualizada' },
      req
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente. Por favor inicia sesión nuevamente.'
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar la contraseña',
      error: error.message
    });
  }
});

// 🏢 GET: Obtener lista de instituciones únicas para los selectores (combos)
router.get('/institutions/list', async (req, res) => {
  try {
    // Traemos los nombres únicos de la tabla de cursos
    const [rows] = await pool.query('SELECT DISTINCT institution FROM courses WHERE institution IS NOT NULL AND institution != "" ORDER BY institution ASC');
    
    res.json({
      success: true,
      data: rows.map(row => row.institution)
    });
  } catch (error) {
    console.error('Error al obtener lista de instituciones:', error);
    res.status(500).json({ success: false, message: 'Error al obtener instituciones' });
  }
});

export default router;

