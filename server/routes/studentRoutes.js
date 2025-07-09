import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin, isTeacherOrAdmin } from '../middleware/authMiddleware.js';
import { log } from 'console';

const router = express.Router();

// Aplicar verificación de token a todas las rutas
router.use(verifyToken);

// Obtener estudiantes por ID de docente
router.get('/teacher/:teacherId', isTeacherOrAdmin, async (req, res) => {
    const { teacherId } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
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
        const query = `
            SELECT s.id, u.name, u.email, u.phone, c.name as course_name
            FROM teacher_students ts
            JOIN students s ON ts.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN courses c ON s.course_id = c.id
            WHERE ts.teacher_id = ?
        `;
        
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

// Obtener un estudiante por ID (docentes pueden ver sus estudiantes, estudiantes solo pueden verse a sí mismos)
router.get('/:id', (req, res, next) => {
  // Si es admin o docente, permitir acceso
  if (req.user.role === 'super_administrador' || req.user.role === 'docente') {
    return next();
  }
  // Si es estudiante, verificar que esté viendo su propia información
  if (req.user.role === 'estudiante' && req.user.student_id === parseInt(req.params.id)) {
    return next();
  }
  // Si no cumple ninguna condición anterior, denegar acceso
  return res.status(403).json({
    success: false,
    message: 'No tienes permiso para acceder a este recurso',
    error: 'FORBIDDEN'
  });
}, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const { id } = req.params;
    const [rows] = await connection.query('SELECT * FROM students WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener estudiante:', error);
    res.status(500).json({ message: 'Error al obtener estudiante' });
  } finally {
    if (connection) connection.release();
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

export default router;
