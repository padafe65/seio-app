import express from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Ruta para obtener todos los docentes
router.get('/', verifyToken, async (req, res) => {
    try {
        console.log('🔍 Obteniendo lista de docentes');
        
        const query = `
            SELECT 
                t.id,
                t.user_id,
                u.name,
                u.email,
                u.phone,
                u.estado as user_estado
            FROM teachers t
            JOIN users u ON t.user_id = u.id
            WHERE u.estado = 'activo'
            ORDER BY u.name ASC
        `;
        
        console.log('🔍 Ejecutando consulta SQL:', query.replace(/\s+/g, ' ').trim());
        
        const [teachers] = await pool.query(query);
        
        console.log(`✅ Se encontraron ${teachers.length} docentes`);
        res.json(teachers);
        
    } catch (error) {
        console.error('❌ Error al obtener la lista de docentes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener la lista de docentes',
            error: error.message
        });
    }
});

// Middleware para verificar el rol de docente o superadmin
const isTeacherOrAdmin = (req, res, next) => {
    if (req.user.role !== 'docente' && req.user.role !== 'super_administrador') {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de Docente o Super Administrador.' });
    }
    next();
};

// Ruta para obtener los estudiantes asignados al docente autenticado
router.get('/students', verifyToken, isTeacherOrAdmin, async (req, res) => {
    console.log('🔍 Iniciando solicitud para obtener estudiantes del docente');
    console.log('📝 Información del usuario:', {
        userId: req.user.id,
        userRole: req.user.role,
        teacherId: req.user.teacher_id
    });
    
    try {
        // Obtener el teacher_id usando el user_id del token
        console.log('🔎 Buscando perfil de docente para el usuario:', req.user.id);
        const [teacher] = await pool.query(
            'SELECT id FROM teachers WHERE user_id = ?',
            [req.user.id]
        );
        
        console.log('📊 Resultado de la consulta de docente:', teacher);
        
        if (!teacher || teacher.length === 0) {
            console.error('❌ No se encontró perfil de docente para el usuario:', req.user.id);
            return res.status(403).json({ 
                success: false,
                message: 'Usuario no tiene un perfil de docente',
                error: 'TEACHER_PROFILE_NOT_FOUND'
            });
        }
        
        const teacherId = teacher[0].id;
        console.log('✅ ID de docente encontrado:', teacherId);
        
        // Verificar si la tabla teacher_students existe
        console.log('🔍 Verificando estructura de la base de datos...');
        try {
            const [tables] = await pool.query("SHOW TABLES LIKE 'teacher_students'");
            console.log('📊 Tablas encontradas que coinciden con teacher_students:', tables);
            
            if (tables.length === 0) {
                console.error('❌ La tabla teacher_students no existe en la base de datos');
                return res.status(500).json({
                    success: false,
                    message: 'Error en la configuración de la base de datos',
                    error: 'MISSING_TABLE_teacher_students'
                });
            }
            
            // Verificar la estructura de la tabla
            const [columns] = await pool.query("SHOW COLUMNS FROM teacher_students");
            console.log('📋 Columnas de teacher_students:', columns.map(c => c.Field));
            
        } catch (dbError) {
            console.error('❌ Error al verificar la estructura de la base de datos:', dbError);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar la estructura de la base de datos',
                error: dbError.message
            });
        }
        
        const query = `
            SELECT 
                s.id, 
                u.name, 
                u.email, 
                u.phone, 
                c.name as course_name,
                s.contact_phone,
                s.contact_email,
                s.age,
                s.grade,
                s.course_id
            FROM teacher_students ts
            JOIN students s ON ts.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN courses c ON s.course_id = c.id
            WHERE ts.teacher_id = ?
        `;
        
        console.log('🔍 Ejecutando consulta SQL:', query.replace(/\s+/g, ' ').trim());
        console.log('📌 Con parámetros:', [teacherId]);
        
        const [students] = await pool.query(query, [teacherId]);
        
        console.log(`✅ Se encontraron ${students.length} estudiantes para el docente ${teacherId}`);
        res.json(students);
        
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

// Ruta para obtener el docente por ID de usuario
router.get('/by-user/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log(`🔍 Buscando docente para el usuario ID: ${userId}`);
        
        // Validar que el userId sea un número
        if (isNaN(userId)) {
            console.error('❌ ID de usuario no válido:', userId);
            return res.status(400).json({
                success: false,
                message: 'ID de usuario no válido',
                error: 'INVALID_USER_ID'
            });
        }
        
        console.log(`🔍 Ejecutando consulta SQL para obtener docente con user_id: ${userId}`);
        
        const [teacher] = await pool.query(
            `SELECT 
                t.id,
                t.user_id,
                t.subject,
                u.name,
                u.email,
                u.phone,
                u.estado,
                u.role
             FROM teachers t 
             JOIN users u ON t.user_id = u.id 
             WHERE t.user_id = ?`,
            [userId]
        );
        
        console.log(`📊 Resultado de la consulta:`, teacher);
        
        if (!teacher || teacher.length === 0) {
            console.error(`❌ No se encontró docente para el usuario ID: ${userId}`);
            return res.status(404).json({ 
                success: false, 
                message: 'Docente no encontrado',
                userId: userId,
                error: 'TEACHER_NOT_FOUND'
            });
        }
        
        const teacherData = teacher[0];
        console.log(`✅ Docente encontrado:`, {
            id: teacherData.id,
            user_id: teacherData.user_id,
            name: teacherData.name,
            email: teacherData.email,
            role: teacherData.role
        });
        
        // Asegurarnos de que el objeto de respuesta tenga el formato esperado
        const response = {
            success: true,
            id: teacherData.id,
            user_id: teacherData.user_id,
            name: teacherData.name,
            email: teacherData.email,
            phone: teacherData.phone,
            subject: teacherData.subject,
            role: teacherData.role,
            estado: teacherData.estado,
            created_at: teacherData.created_at,
            updated_at: teacherData.updated_at
        };
        
        console.log('📤 Enviando respuesta:', response);
        res.status(200).json(response);
        
    } catch (error) {
        console.error('❌ Error al obtener docente por ID de usuario:', error);
        
        // Si es un error de SQL, mostramos más detalles
        if (error.code) {
            console.error('🔍 Detalles del error SQL:', {
                code: error.code,
                errno: error.errno,
                sqlMessage: error.sqlMessage,
                sqlState: error.sqlState,
                sql: error.sql
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener información del docente',
            error: error.message,
            code: error.code,
            sqlMessage: error.sqlMessage
        });
    }
});

// Obtener grados de estudiantes asignados a un docente
router.get('/student-grades', verifyToken, isTeacherOrAdmin, async (req, res) => {
    try {
        const teacherId = req.user.teacher_id;
        if (!teacherId) {
            return res.status(403).json({ message: 'Usuario no tiene un perfil de docente' });
        }
        const query = `
            SELECT er.id, s.id AS student_id, u.name AS student_name, q.name AS quiz_name, er.score, er.evaluation_date
            FROM evaluation_results er
            JOIN students s ON er.student_id = s.id
            JOIN users u ON s.user_id = u.id
            JOIN quizzes q ON er.quiz_id = q.id
            JOIN teacher_students ts ON s.id = ts.student_id
            WHERE ts.teacher_id = ?
            ORDER BY er.evaluation_date DESC
        `;
        const [grades] = await pool.query(query, [teacherId]);
        res.json(grades);
    } catch (error) {
        console.error('❌ Error al obtener calificaciones de los estudiantes:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Obtener ID de profesor por user_id
router.get('/user/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const [teacher] = await pool.query(
            'SELECT id FROM teachers WHERE user_id = ?', 
            [userId]
        );
        
        if (teacher.length === 0) {
            return res.status(404).json({ message: 'Profesor no encontrado' });
        }
        
        res.json(teacher[0]);
    } catch (error) {
        console.error('❌ Error al obtener ID de profesor:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

export default router;
