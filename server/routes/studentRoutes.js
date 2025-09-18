import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin, isTeacherOrAdmin } from '../middleware/authMiddleware.js';
import { 
  getStudents,
  getStudentById, 
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentStats
} from '../controllers/studentController.js';
import { fileURLToPath } from 'url';
import path from 'path';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de multer para subir archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/students'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'student-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif)'));
  }
});

const router = express.Router();

// Aplicar verificación de token a todas las rutas
router.use(verifyToken);

// Obtener todos los estudiantes (solo administradores)
router.get('/', isAdmin, getStudents);

// Crear un nuevo estudiante (solo administradores)
router.post('/', isAdmin, upload.single('profileImage'), createStudent);

// Obtener un estudiante por ID
router.get('/:id', isTeacherOrAdmin, getStudentById);

// Actualizar un estudiante
router.patch('/:id', isTeacherOrAdmin, upload.single('profileImage'), updateStudent);

// Eliminar un estudiante (solo administradores)
router.delete('/:id', isAdmin, deleteStudent);

// Obtener estadísticas del estudiante
router.get('/:id/stats', isTeacherOrAdmin, getStudentStats);

// Obtener estudiantes por ID de docente
router.get('/teacher/:teacherId', isTeacherOrAdmin, async (req, res) => {
    const { teacherId } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    console.log('🔍 Parámetros recibidos:', { teacherId, requestingUserId, requestingUserRole });
    
    console.log(`📝 [${new Date().toISOString()}] Iniciando solicitud para estudiantes del docente ${teacherId}`);
    console.log(`👤 Usuario autenticado: ID=${requestingUserId}, Rol=${requestingUserRole}`);
    console.log('🔍 Parámetros de la solicitud:', {
        params: req.params,
        query: req.query,
        user: {
            id: req.user.id,
            role: req.user.role,
            teacher_id: req.user.teacher_id
        }
    });
    
    try {
        // Si el usuario es docente, verificar que solo pueda ver sus propios estudiantes
        if (requestingUserRole === 'docente') {
            console.log('🔍 Verificando permisos del docente...');
            const [teacher] = await pool.query(
                'SELECT id FROM teachers WHERE user_id = ?',
                [requestingUserId]
            );
            
            if (!teacher || teacher.length === 0 || teacher[0].id.toString() !== teacherId) {
                console.error('❌ Intento de acceso no autorizado a estudiantes de otro docente');
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para ver los estudiantes de este docente',
                    error: 'FORBIDDEN'
                });
            }

            // Obtener los estudiantes asignados al docente con los campos correctos
            console.log('🔍 Ejecutando consulta para obtener estudiantes del docente:', teacherId);
            const [students] = await pool.query(`
                SELECT 
                    s.id,
                    s.user_id,
                    s.contact_phone,
                    s.contact_email,
                    s.age,
                    s.grade,
                    s.course_id,
                    u.name,
                    u.email,
                    u.phone,
                    c.name as course_name
                FROM teacher_students ts
                JOIN students s ON ts.student_id = s.id
                JOIN users u ON s.user_id = u.id
                LEFT JOIN courses c ON s.course_id = c.id
                WHERE ts.teacher_id = ?
                ORDER BY u.name
            `, [teacherId]);
            
            console.log('📊 Resultado de la consulta de estudiantes:', students);

            console.log('📊 Estudiantes encontrados:', students);
            
            return res.json({
                success: true,
                data: students.map(student => ({
                    id: student.id,
                    user_id: student.user_id,
                    name: student.name,
                    email: student.email,
                    phone: student.phone,
                    contact_phone: student.contact_phone,
                    contact_email: student.contact_email,
                    grade: student.grade,
                    course_name: student.course_name
                }))
            });
        }
        
        // Verificar que el docente exista
        const [teacher] = await pool.query(
            'SELECT id FROM teachers WHERE id = ?',
            [teacherId]
        );
        
        if (!teacher || teacher.length === 0) {
            console.error(`❌ No se encontró el docente con ID ${teacherId}`);
            return res.status(404).json({
                success: false,
                message: 'Docente no encontrado',
                error: 'TEACHER_NOT_FOUND'
            });
        }
        
        // Primero, verificar la estructura de la tabla teacher_students
        console.log('🔍 Verificando estructura de la tabla teacher_students...');
        try {
            const [columns] = await pool.query('DESCRIBE teacher_students');
            console.log('📋 Estructura de teacher_students:', columns);
            
            // Verificar si las columnas necesarias existen
            const requiredColumns = ['teacher_id', 'student_id'];
            const existingColumns = columns.map(col => col.Field);
            const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
            
            if (missingColumns.length > 0) {
                console.error(`❌ Faltan columnas requeridas en teacher_students: ${missingColumns.join(', ')}`);
                return res.status(500).json({
                    success: false,
                    message: 'Error en la estructura de la base de datos',
                    error: `Faltan columnas requeridas: ${missingColumns.join(', ')}`
                });
            }
        } catch (error) {
            console.error('❌ Error al verificar la estructura de teacher_students:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar la estructura de la base de datos',
                error: error.message
            });
        }
        
        // Obtener los estudiantes asignados al docente
        console.log('🔍 Obteniendo estudiantes para el docente ID:', teacherId);
        const query = `
            SELECT 
                s.id, 
                s.user_id,
                u.name, 
                u.email,
                u.phone,
                u.role,
                s.grade,
                s.photo_url,
                s.created_at,
                s.updated_at,
                ts.teacher_id,
                c.name as course_name,
                c.grade as course_grade,
                c.section as course_section,
                i.name as institution_name,
                i.city as institution_city,
                i.department as institution_department
            FROM students s
            JOIN users u ON s.user_id = u.id
            JOIN teacher_students ts ON s.id = ts.student_id
            LEFT JOIN courses c ON ts.course_id = c.id
            LEFT JOIN institutions i ON c.institution_id = i.id
            WHERE ts.teacher_id = ?
            ORDER BY u.name ASC`;
        
        console.log(`🔍 Ejecutando consulta para estudiantes del docente ${teacherId}`);
        const [students] = await pool.query(query, [teacherId]);
        
        console.log(`✅ Se encontraron ${students.length} estudiantes para el docente ${teacherId}`);
        res.json({
            success: true,
            data: students,
            count: students.length
        });
        
    } catch (error) {
        console.error('❌ Error al obtener estudiantes del docente:', error);
        console.error('📌 Stack trace:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Error al obtener estudiantes del docente',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Obtener todos los estudiantes (solo administradores)
router.get('/', isAdmin, async (req, res) => {
  try {
    const [students] = await pool.query(`
      SELECT s.*, u.name, u.email, u.phone, c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
    `);
    res.json(students);
  } catch (error) {
    console.error('Error al obtener estudiantes:', error);
    res.status(500).json({ message: 'Error al obtener estudiantes' });
  } finally {
    if (connection) connection.release();
  }
});

// Obtener un estudiante por ID
router.get('/:id', verifyToken, async (req, res) => {
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
        u.email as email,
        u.phone as phone,
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
      success: false,
      message: 'Error al obtener estudiante',
      error: error.message
    });
  }
});

// Obtener estudiantes por profesor y grado
router.get('/teacher/:teacherId/grade/:grade', isTeacherOrAdmin, async (req, res) => {
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
        const [students] = await pool.query(`
            SELECT DISTINCT s.*, u.name, u.last_name, u.email, u.phone
            FROM students s
            JOIN users u ON s.user_id = u.id
            JOIN teacher_students ts ON s.id = ts.student_id
            WHERE ts.teacher_id = ? AND s.grade = ?
            ORDER BY u.name, u.last_name
        `, [teacherId, grade]);
        
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

// Obtener estudiantes por profesor (usando user_id del profesor)
router.get('/teacher/:userId', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const { userId } = req.params;
    
    // Primero obtenemos el teacher_id usando el user_id
    const [teacher] = await connection.query(
      'SELECT id FROM teachers WHERE user_id = ?', 
      [userId]
    );
    
    if (!teacher || teacher.length === 0) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }
    
    const teacherId = teacher[0].id;
    
    // Luego obtenemos los estudiantes asignados a este profesor
    const [rows] = await connection.query(`
      SELECT s.*, u.name, u.email, u.phone, c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN teacher_students ts ON s.id = ts.student_id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE ts.teacher_id = ?
    `, [teacherId]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener estudiantes del profesor:', error);
    res.status(500).json({ message: 'Error al obtener estudiantes del profesor' });
  } finally {
    if (connection) connection.release();
  }
});

// Obtener los docentes de un estudiante
router.get('/:id/teachers', isTeacherOrAdmin, async (req, res) => {
    const studentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📝 [${new Date().toISOString()}] Obteniendo docentes del estudiante ${studentId}`);
    console.log(`👤 Usuario autenticado: ID=${userId}, Rol=${userRole}`);

    try {
        // Verificar que el estudiante exista
        const [student] = await pool.query('SELECT id FROM students WHERE id = ?', [studentId]);
        if (!student || student.length === 0) {
            console.error(`❌ No se encontró el estudiante con ID ${studentId}`);
            return res.status(404).json({
                success: false,
                message: 'Estudiante no encontrado',
                error: 'STUDENT_NOT_FOUND'
            });
        }

        // Si es docente, verificar que el estudiante esté asignado a él
        if (userRole === 'docente') {
            const [teacher] = await pool.query(
                'SELECT id FROM teachers WHERE user_id = ?', 
                [userId]
            );

            if (teacher.length === 0) {
                console.error('❌ El usuario no tiene un perfil de docente');
                return res.status(403).json({
                    success: false,
                    message: 'No estás registrado como docente',
                    error: 'TEACHER_NOT_FOUND'
                });
            }

            const [assignment] = await pool.query(
                'SELECT * FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
                [teacher[0].id, studentId]
            );

            if (assignment.length === 0) {
                console.error('❌ El estudiante no está asignado a este docente');
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para ver este estudiante',
                    error: 'FORBIDDEN'
                });
            }
        }

        // Obtener los docentes del estudiante
        const [teachers] = await pool.query(`
            SELECT 
                t.id,
                u.name,
                u.email,
                u.phone
            FROM teacher_students ts
            JOIN teachers t ON ts.teacher_id = t.id
            JOIN users u ON t.user_id = u.id
            WHERE ts.student_id = ?
            ORDER BY u.name
        `, [studentId]);

        console.log(`📊 Docentes encontrados para el estudiante ${studentId}:`, teachers);
        
        res.json({
            success: true,
            data: teachers
        });

    } catch (error) {
        console.error('❌ Error al obtener docentes del estudiante:', error);
        console.error('📌 Stack trace:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener los docentes del estudiante',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

export default router;
