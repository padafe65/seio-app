// routes/teachers.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware para verificar el rol de docente o superadmin
const isTeacherOrAdmin = (req, res, next) => {
    if (req.user.role !== 'docente' && req.user.role !== 'super_administrador') {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de Docente o Super Administrador.' });
    }
    next();
};

// Aplicar middleware de verificación de token a todas las rutas
router.use(verifyToken);

// Obtener todos los profesores con sus datos de usuario (solo admin)
router.get('/', isTeacherOrAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.*, u.name, u.email, u.phone, u.role 
      FROM teachers t
      JOIN users u ON t.user_id = u.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener profesores:', error);
    res.status(500).json({ message: 'Error al obtener profesores' });
  }
});

// Obtener lista de profesores (filtrada por curso/grado/institución)
// IMPORTANTE: Esta ruta debe ir ANTES de /:id para que /list no sea capturado como id
router.get('/list', async (req, res) => {
  try {
    const { course_id, grade, institution } = req.query;
    
    console.log('🔍 [GET] /api/teachers/list - Parámetros recibidos:', { course_id, grade, institution });
    
    // Verificar si el campo institution existe en users
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
      console.log('⚠️ Campo institution no disponible aún en users');
    }
    
    let query = `
      SELECT DISTINCT t.id, t.subject, u.name, u.email, u.phone
    `;
    
    if (hasInstitution) {
      query += `, u.institution`;
    }
    
    query += `
      FROM teachers t
      JOIN users u ON t.user_id = u.id
    `;
    
    const params = [];
    const conditions = [];
    
    // Si se proporciona course_id, filtrar por profesores que enseñan ese curso
    if (course_id) {
      query += ` INNER JOIN teacher_courses tc ON t.id = tc.teacher_id`;
      conditions.push('tc.course_id = ?');
      params.push(course_id);
      console.log('📌 Filtro por course_id:', course_id);
    }
    // Si se proporciona grade, filtrar por profesores que enseñan cursos de ese grado
    else if (grade) {
      query += `
        INNER JOIN teacher_courses tc ON t.id = tc.teacher_id
        INNER JOIN courses c ON tc.course_id = c.id
      `;
      conditions.push('c.grade = ?');
      params.push(grade);
      console.log('📌 Filtro por grade:', grade);
    }
    
    // Si se proporciona institution, filtrar por profesores de esa institución
    if (institution && hasInstitution) {
      // Usar comparación flexible: exacta o que contenga la palabra clave
      // Ejemplo: "La Chucua" coincidirá con "Colegio La Chucua" y viceversa
      // Extraer palabras clave de la institución (ej: "La Chucua" de "Colegio La Chucua")
      const institutionTrimmed = institution.trim();
      const institutionWords = institutionTrimmed.split(/\s+/).filter(w => w.length > 2);
      const mainKeyword = institutionWords.length > 1 ? institutionWords.slice(-2).join(' ') : institutionTrimmed;
      
      conditions.push(`(
        LOWER(TRIM(COALESCE(u.institution, ''))) = LOWER(TRIM(?)) 
        OR LOWER(TRIM(COALESCE(u.institution, ''))) LIKE CONCAT('%', LOWER(TRIM(?)), '%')
        OR LOWER(TRIM(COALESCE(u.institution, ''))) LIKE CONCAT('%', LOWER(TRIM(?)), '%')
        OR LOWER(TRIM(?)) LIKE CONCAT('%', LOWER(TRIM(COALESCE(u.institution, ''))), '%')
      )`);
      params.push(institutionTrimmed, institutionTrimmed, mainKeyword, institutionTrimmed);
      console.log('📌 Filtro por institution (flexible):', institutionTrimmed, '| Palabra clave:', mainKeyword);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY u.name`;
    
    console.log('📝 Query SQL:', query);
    console.log('📝 Parámetros:', params);
    
    const [rows] = await pool.query(query, params);
    
    console.log(`✅ Profesores encontrados: ${rows.length}`);
    if (rows.length > 0) {
      console.log('👨‍🏫 Primeros profesores:', rows.slice(0, 3).map(t => ({ 
        id: t.id, 
        name: t.name, 
        institution: t.institution,
        subject: t.subject 
      })));
    } else {
      // Si no hay resultados y hay filtros, intentar una consulta más relajada
      if (conditions.length > 0) {
        console.log('⚠️ No se encontraron profesores con los filtros estrictos, intentando búsqueda más relajada...');
        
        // Si hay course_id e institution, intentar primero solo por institution
        if (course_id && institution && hasInstitution) {
          console.log('🔍 Intentando búsqueda solo por institución (sin filtro de curso)...');
          const institutionTrimmed = institution.trim();
          const institutionWords = institutionTrimmed.split(/\s+/).filter(w => w.length > 2);
          const mainKeyword = institutionWords.length > 1 ? institutionWords.slice(-2).join(' ') : institutionTrimmed;
          
          const relaxedQuery = `
            SELECT DISTINCT t.id, t.subject, u.name, u.email, u.phone, u.institution
            FROM teachers t
            JOIN users u ON t.user_id = u.id
            WHERE (
              LOWER(TRIM(COALESCE(u.institution, ''))) = LOWER(TRIM(?)) 
              OR LOWER(TRIM(COALESCE(u.institution, ''))) LIKE CONCAT('%', LOWER(TRIM(?)), '%')
              OR LOWER(TRIM(COALESCE(u.institution, ''))) LIKE CONCAT('%', LOWER(TRIM(?)), '%')
              OR LOWER(TRIM(?)) LIKE CONCAT('%', LOWER(TRIM(COALESCE(u.institution, ''))), '%')
            )
            ORDER BY u.name
          `;
          const [relaxedRows] = await pool.query(relaxedQuery, [
            institutionTrimmed, 
            institutionTrimmed, 
            mainKeyword, 
            institutionTrimmed
          ]);
          console.log(`🔍 Búsqueda relajada (solo institución): ${relaxedRows.length} profesores encontrados`);
          if (relaxedRows.length > 0) {
            console.log('💡 Sugerencia: Los profesores encontrados no tienen el curso asignado en teacher_courses.');
            console.log('💡 Profesores de la institución:', relaxedRows.map(t => ({ 
              id: t.id, 
              name: t.name, 
              institution: t.institution 
            })));
            // Devolver los profesores de la institución aunque no tengan el curso asignado
            // Esto permite al usuario asignar el curso después
            return res.json(relaxedRows);
          }
        }
        // Si solo hay institution sin course_id, verificar que haya profesores
        else if (institution && hasInstitution && !course_id && !grade) {
          console.log('⚠️ No se encontraron profesores para la institución:', institution);
          console.log('💡 Verifica que los profesores tengan la institución asignada en la tabla users');
        }
      }
    }
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener lista de profesores:', error);
    console.error('📌 Stack trace:', error.stack);
    res.status(500).json({ message: 'Error al obtener lista de profesores', error: error.message });
  }
});

// Obtener un profesor por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(
      `SELECT t.*, u.name, u.email, u.phone, u.role 
       FROM teachers t
       JOIN users u ON t.user_id = u.id 
       WHERE t.id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error al obtener profesor:', error);
    res.status(500).json({ message: 'Error al obtener profesor' });
  }
});

// Crear un nuevo profesor
router.post('/', isAdmin, async (req, res) => {
  try {
    const { user_id, subject, institution } = req.body;
    
    // Verificar si el usuario ya es profesor
    const [existingTeacher] = await pool.query(
      'SELECT * FROM teachers WHERE user_id = ?',
      [user_id]
    );
    
    if (existingTeacher.length > 0) {
      return res.status(400).json({ message: 'Este usuario ya está registrado como profesor' });
    }
    
    // 1. Verificar si el campo institution existe en la tabla users
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
      console.log('⚠️ No se pudo verificar si existe el campo institution en users');
    }
    
    // 2. Crear el profesor en la tabla teachers
    const [result] = await pool.query(
      'INSERT INTO teachers (user_id, subject, institution) VALUES (?, ?, ?)',
      [user_id, subject, institution]
    );
    
    // 3. Actualizar el rol del usuario a 'docente' si no lo es ya
    await pool.query(
      "UPDATE users SET role = 'docente' WHERE id = ? AND role != 'super_administrador'",
      [user_id]
    );
    
    // 4. Actualizar institution en la tabla users si existe el campo
    if (hasInstitution && institution) {
      await pool.query(
        'UPDATE users SET institution = ? WHERE id = ?',
        [institution, user_id]
      );
      console.log('✅ Campo institution actualizado en users:', institution);
    } else if (institution) {
      console.log('⚠️ El campo institution fue enviado pero no existe en la tabla users');
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Profesor registrado correctamente',
      teacherId: result.insertId 
    });
  } catch (error) {
    console.error('❌ Error al crear profesor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear profesor',
      error: error.message 
    });
  }
});

// Actualizar un profesor
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, institution } = req.body;
    
    const [result] = await pool.query(
      'UPDATE teachers SET subject = ?, institution = ? WHERE id = ?',
      [subject, institution, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    res.json({ 
      success: true, 
      message: 'Profesor actualizado correctamente' 
    });
  } catch (error) {
    console.error('❌ Error al actualizar profesor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar profesor',
      error: error.message 
    });
  }
});

// Eliminar un profesor
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener el user_id del profesor
    const [teacherRows] = await pool.query(
      'SELECT user_id FROM teachers WHERE id = ?',
      [id]
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    const userId = teacherRows[0].user_id;
    
    // Iniciar transacción
    await pool.query('START TRANSACTION');
    
    try {
      // Eliminar relaciones del profesor con estudiantes
      await pool.query('DELETE FROM teacher_students WHERE teacher_id = ?', [id]);
      
      // Eliminar al profesor
      await pool.query('DELETE FROM teachers WHERE id = ?', [id]);
      
      // Si el usuario no es super_administrador, cambiar su rol a 'estudiante'
      await pool.query(
        "UPDATE users SET role = 'estudiante' WHERE id = ? AND role != 'super_administrador'",
        [userId]
      );
      
      // Confirmar transacción
      await pool.query('COMMIT');
      
      res.json({ 
        success: true, 
        message: 'Profesor eliminado correctamente' 
      });
    } catch (error) {
      // Revertir transacción en caso de error
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Error al eliminar profesor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar profesor',
      error: error.message 
    });
  }
});

// Obtener estudiantes de un profesor por grado
router.get('/:teacherId/students/by-grade/:grade', isTeacherOrAdmin, async (req, res) => {
    const { teacherId, grade } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    console.log(`🔍 Buscando estudiantes para el docente ${teacherId} en el grado ${grade}`);
    
    try {
        // Verificar permisos para el docente
        if (requestingUserRole === 'docente') {
            const [teacher] = await pool.query(
                'SELECT id FROM teachers WHERE user_id = ?',
                [requestingUserId]
            );
            
            if (!teacher.length || teacher[0].id !== parseInt(teacherId)) {
                console.warn('⚠️ Intento de acceso no autorizado a estudiantes de otro docente');
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para ver los estudiantes de este docente',
                    error: 'No autorizado',
                    code: 'UNAUTHORIZED_ACCESS'
                });
            }
        }
        
        // Obtener estudiantes del docente filtrados por grado
        console.log(`🔍 Ejecutando consulta para docente ${teacherId} y grado ${grade}`);
        const [students] = await pool.query(`
            SELECT DISTINCT s.*, u.name, u.email, u.phone, c.grade
            FROM students s
            JOIN users u ON s.user_id = u.id
            JOIN teacher_students ts ON s.id = ts.student_id
            JOIN courses c ON s.course_id = c.id
            WHERE ts.teacher_id = ? AND c.grade = ?
            ORDER BY u.name
        `, [teacherId, grade]);
        
        console.log(`📊 Resultado de la consulta:`, students);
        
        if (!students.length) {
            console.log(`ℹ️ No se encontraron estudiantes para el docente ${teacherId} en el grado ${grade}`);
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No se encontraron estudiantes para este grado',
                count: 0
            });
        }
        
        console.log(`✅ Se encontraron ${students.length} estudiantes para el docente ${teacherId} en el grado ${grade}`);
        
        res.json({
            success: true,
            data: students,
            count: students.length
        });
        
    } catch (error) {
        console.error('❌ Error al obtener estudiantes del docente por grado:', error);
        console.error('📌 Stack trace:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener estudiantes',
            error: error.message,
            code: 'SERVER_ERROR'
        });
    }
});

// Obtener estudiantes de un profesor
router.get('/:id/students', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(`
      SELECT s.*, u.name, u.email, u.phone, u.role,
             c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      JOIN teacher_students ts ON s.id = ts.student_id
      WHERE ts.teacher_id = ?
    `, [id]);
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener estudiantes del profesor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estudiantes del profesor',
      error: error.message 
    });
  }
});

// Obtener lista de profesores con sus nombres
router.get('/list/all', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.id, t.subject, u.name 
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      ORDER BY u.name
    `);
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener lista de profesores:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener lista de profesores',
      error: error.message 
    });
  }
});

// Obtener información de un profesor por su user_id
router.get('/by-user/:userId', verifyToken, async (req, res) => {
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
      `SELECT s.*, u.name, u.email, u.phone, c.name as course_name
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
});

export default router;
