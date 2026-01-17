// Core modules
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Route imports
import questionRoutes from './routes/questionRoutes.js';
import questionnaireRoutes from './routes/questionnaireRoutes.js';
import quizRoutes from './routes/quiz.js';
import studentRoutes from './routes/studentRoutes.js';
import evaluationResultsRoutes from './routes/evaluationResults.js';
import improvementPlansRoutes from './routes/improvementPlans.js';
import phaseEvaluationRoutes from './routes/phaseEvaluation.js';
import questionnaireIndicatorsRoutes from './routes/questionnaireIndicators.js';
import indicatorEvaluationRoutes from './routes/indicatorEvaluation.js';

// Middleware imports
import { verifyToken, isAdmin, isSuperAdmin } from './middleware/authMiddleware.js';
import { recalculatePhaseAverages, recalculateAllStudentsPhaseAverages } from './utils/recalculatePhaseAverages.js';
import teacherCoursesRoutes from './routes/teacherCoursesRoutes.js';
import teachers from './routes/teachers.js';
import teacherRoutes from './routes/teacherRoutes.js';
import indicatorsRoutes from './routes/indicatorRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import pool from './config/db.js';
import { syncSubjectCategories } from './utils/syncSubjectCategories.js';


dotenv.config();

// Verifica que las variables de entorno estén siendo cargadas correctamente
console.log("🔍 Verificando variables de entorno:");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD === '' ? '(vacío)' : process.env.DB_PASSWORD === 'empty' ? '(interpreta como vacío)' : '(oculta)');
console.log("DB_NAME:", process.env.DB_NAME);
console.log("JWT_SECRET:", process.env.JWT_SECRET ? '(cargado)' : '(no cargado)');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Conexión a MySQL
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Verificar conexión al iniciar
db.getConnection()
.then(conn => {
  console.log('✅ Conexión exitosa a TiDB');
  conn.release();
})
.catch(err => {
  console.error('❌ Error al conectar a TiDB:', err);
});

const app = express();

// Configuración de CORS
const corsOptions = {
  origin: 'http://localhost:3000', // Reemplaza con tu URL de frontend
  credentials: true, // Habilita el envío de cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json()); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ⚠️ IMPORTANTE: Definir rutas de autenticación ANTES de montar otras rutas que requieren token
// Esto asegura que /api/auth/login y /api/auth/register no sean interceptadas por middleware de autenticación

// Configuración de rutas (rutas públicas primero)
// Las rutas específicas deben ir antes de las rutas generales que requieren autenticación
// IMPORTANTE: La ruta POST /api/students para completar registros debe ir ANTES del router
// para que tenga prioridad sobre router.post('/', ...) que crea usuarios nuevos

// Ruta para completar datos de estudiante (debe ir ANTES de studentRoutes)
app.post('/api/students', async (req, res) => {
  try {
    const { user_id, name, contact_phone, contact_email, age, grade, course_id, teacher_id } = req.body;
    
    console.log("Datos recibidos para estudiante:", req.body);
    
    // Si no hay user_id pero hay name, crear primero el usuario
    let userId = user_id;
    
    if (!userId && name) {
      // Crear un nuevo usuario con estado 'activo'
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const [userResult] = await db.query(
        'INSERT INTO users (name, email, phone, password, role, estado) VALUES (?, ?, ?, ?, ?, ?)',
        [name, contact_email, contact_phone, hashedPassword, 'estudiante', 'activo']
      );
      
      userId = userResult.insertId;
      console.log("Usuario creado con ID:", userId);
    }
    
    // Verificar que user_id no sea nulo
    if (!userId) {
      return res.status(400).json({ message: 'El campo user_id es obligatorio' });
    }
    
    // Verificar si ya existe un registro de estudiante para este user_id
    const [existingStudent] = await db.query(
      'SELECT id FROM students WHERE user_id = ?',
      [userId]
    );
    
    let studentId;
    
    // Verificar si el campo institution existe en users y students
    let hasInstitution = false;
    try {
      const [columns] = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {
      // Ignorar error, asumir que no existe
    }
    
    // Obtener institution del usuario si existe
    let userInstitution = null;
    if (hasInstitution) {
      try {
        const [userData] = await db.query('SELECT institution FROM users WHERE id = ?', [userId]);
        userInstitution = userData.length > 0 ? userData[0].institution : null;
      } catch (error) {
        // Ignorar error
      }
    }
    
    if (existingStudent.length > 0) {
      // Si ya existe, actualizar el registro existente
      studentId = existingStudent[0].id;
      if (hasInstitution) {
        await db.query(
          'UPDATE students SET contact_phone = ?, contact_email = ?, age = ?, grade = ?, course_id = ?, institution = ? WHERE id = ?',
          [contact_phone, contact_email, age, grade, course_id, userInstitution, studentId]
        );
      } else {
        await db.query(
          'UPDATE students SET contact_phone = ?, contact_email = ?, age = ?, grade = ?, course_id = ? WHERE id = ?',
          [contact_phone, contact_email, age, grade, course_id, studentId]
        );
      }
    } else {
      // Si no existe, crear nuevo registro
      if (hasInstitution) {
        const [result] = await db.query(
          'INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id, institution) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, contact_phone, contact_email, age, grade, course_id, userInstitution]
        );
        studentId = result.insertId;
      } else {
        const [result] = await db.query(
          'INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, contact_phone, contact_email, age, grade, course_id]
        );
        studentId = result.insertId;
      }
    }
    
    // Verificar que studentId esté definido
    if (!studentId) {
      console.error('❌ studentId no está definido después de crear/actualizar estudiante');
      return res.status(500).json({ message: 'Error: No se pudo obtener el ID del estudiante' });
    }
    
    // Si se proporcionó un teacher_id, crear/actualizar la relación en teacher_students
    if (teacher_id) {
      try {
        console.log(`🔗 Creando relación teacher_students: teacher_id=${teacher_id}, student_id=${studentId}`);
        
        // Eliminar relaciones existentes primero
        await db.query(
          'DELETE FROM teacher_students WHERE student_id = ?',
          [studentId]
        );
        
        // Crear nueva relación
        await db.query(
          'INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)',
          [teacher_id, studentId]
        );
        
        console.log(`✅ Relación teacher_students creada exitosamente`);
      } catch (relError) {
        console.error('❌ Error al crear relación teacher_students:', relError);
        // Si es error de duplicado, no es crítico - continuar
        if (relError.code !== 'ER_DUP_ENTRY') {
          throw relError; // Re-lanzar si no es duplicado
        }
        console.log('⚠️ Relación ya existía, continuando...');
      }
    }
    
    console.log(`✅ Estudiante ${existingStudent.length > 0 ? 'actualizado' : 'creado'} exitosamente con ID: ${studentId}`);
    
    res.status(201).json({ 
      message: existingStudent.length > 0 ? 'Datos de estudiante actualizados correctamente' : 'Estudiante registrado correctamente', 
      studentId: studentId 
    });
  } catch (error) {
    console.error('❌ Error registrando estudiante:', error);
    console.error('📌 Stack trace:', error.stack);
    console.error('📌 Error code:', error.code);
    console.error('📌 Error message:', error.message);
    console.error('📌 SQL State:', error.sqlState);
    console.error('📌 Request body:', req.body);
    
    // Si es error de duplicado en teacher_students, ignorarlo y continuar
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('⚠️ Error de duplicado detectado, pero continuando...');
      // Intentar obtener studentId si está disponible
      let existingStudentId;
      if (req.body.user_id) {
        try {
          const [existing] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.body.user_id]);
          if (existing.length > 0) {
            existingStudentId = existing[0].id;
          }
        } catch (e) {
          // Ignorar
        }
      }
      return res.status(201).json({ 
        message: 'Estudiante registrado correctamente (relación con profesor ya existía)', 
        studentId: existingStudentId 
      });
    }
    
    res.status(500).json({ 
      message: 'Error al registrar estudiante', 
      error: error.message,
      sqlError: error.sqlMessage || undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ⚠️ RUTA DIRECTA PARA COMPLETAR REGISTRO DE DOCENTE (debe ir ANTES del router)
// Ruta para completar datos de teacher (pública para permitir completar registro inicial)
app.post('/api/teachers', async (req, res) => {
  try {
    const { user_id, subject, institution } = req.body;

    console.log("📝 Datos recibidos para docente:", req.body);

    // 1. Verificar si el campo institution existe en la tabla users
    let hasInstitution = false;
    try {
      const [columns] = await db.query(`
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

    // 2. Crear el registro en la tabla teachers
    const result = await db.query(
      'INSERT INTO teachers (user_id, subject, institution) VALUES (?, ?, ?)',
      [user_id, subject, institution]
    );

    // 3. Actualizar institution en la tabla users si existe el campo
    if (hasInstitution && institution) {
      await db.query(
        'UPDATE users SET institution = ? WHERE id = ?',
        [institution, user_id]
      );
      console.log('✅ Campo institution actualizado en users:', institution);
    } else if (institution) {
      console.log('⚠️ El campo institution fue enviado pero no existe en la tabla users');
    }

    res.status(201).json({ 
      success: true,
      message: 'Docente registrado correctamente', 
      teacherId: result.insertId 
    });

  } catch (error) {
    console.error('❌ Error registrando docente:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al registrar docente',
      error: error.message 
    });
  }
});

// Registrar el router de estudiantes DESPUÉS de la ruta específica para completar registros
app.use('/api/students', studentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/questionnaires', questionnaireRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/evaluation-results', evaluationResultsRoutes);
app.use('/api/phase-evaluation', phaseEvaluationRoutes);
app.use('/api/teachers', teachers);
app.use('/api/teacher', teacherRoutes);
app.use('/api/teacher-courses', teacherCoursesRoutes);
app.use('/api/questionnaire-indicators', questionnaireIndicatorsRoutes);
app.use('/api/indicator-evaluation', indicatorEvaluationRoutes);
app.use('/api/indicators', indicatorsRoutes);
app.use('/api', improvementPlansRoutes);

// ⚠️ usersRoutes DEBE ir DESPUÉS de definir las rutas de auth
// porque usersRoutes aplica verifyToken a todas las rutas que empiezan con /api
// Si va antes, interceptará /api/auth/login
app.use('/api/admin', usersRoutes);

// Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nombre = `comprobante_${Date.now()}${ext}`;
    cb(null, nombre);
  }
});

const upload = multer({ storage });

// 🚨 ESTA ES LA RUTA QUE DEBES TENER
app.post('/api/subir-comprobante/:id', upload.single('imagen'), async (req, res) => {
  try {
    const rifaId = req.params.id;
    const imagenNombre = req.file.filename;

    const [result] = await db.query(
      'UPDATE numeros_jugados SET estado = "Cancelado", imagen_pago = ? WHERE id = ?',
      [imagenNombre, rifaId]
    );

    res.json({ mensaje: '✔️ Comprobante subido y estado actualizado', imagen: imagenNombre });
  } catch (err) {
    console.error('❌ Error actualizando comprobante:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('🔐 ========== INICIO DE LOGIN ==========');
  console.log('🔐 Email recibido:', email ? email.substring(0, 10) + '...' : 'undefined');
  console.log('🔐 Password recibido:', password ? '***' + password.substring(password.length - 2) : 'undefined');

  try {
    if (!email || !password) {
      console.log('❌ Email o contraseña vacíos');
      return res.status(401).json({ 
        success: false,
        error: "Email y contraseña son requeridos" 
      });
    }

    console.log('📊 Buscando usuario en la base de datos...');
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    console.log(`📊 Usuarios encontrados: ${rows.length}`);

    if (rows.length === 0) {
      console.log('❌ Usuario no encontrado en la base de datos');
      return res.status(401).json({ 
        success: false,
        error: "Usuario no encontrado" 
      });
    }

    const user = rows[0];
    console.log('✅ Usuario encontrado:', { 
      id: user.id, 
      email: user.email, 
      role: user.role, 
      estado: user.estado,
      estadoType: typeof user.estado,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0
    });
    
    // Verificar si el usuario está activo - SOLO si el campo existe Y es explícitamente 0 o false
    // Si el campo no existe, es null, undefined, o cualquier otro valor, asumimos que está activo
    if (user.estado === 0 || user.estado === false || user.estado === '0' || user.estado === 'false') {
      console.log('❌ Usuario inactivo. Estado:', user.estado, 'Tipo:', typeof user.estado);
      return res.status(401).json({ 
        success: false,
        error: "Usuario inactivo. Contacta al administrador." 
      });
    }
    
    console.log('✅ Usuario activo (o sin restricción de estado), continuando con verificación de contraseña...');
    
    console.log('🔒 Verificando contraseña...');
    console.log('🔒 Password recibido (primeros 10 chars):', password ? password.substring(0, 10) : 'undefined');
    console.log('🔒 Hash almacenado (primeros 20 chars):', user.password ? user.password.substring(0, 20) : 'undefined');
    
    if (!user.password) {
      console.log('❌ El usuario no tiene contraseña almacenada');
      return res.status(401).json({ 
        success: false,
        error: "Usuario sin contraseña configurada. Contacta al administrador." 
      });
    }

    try {
      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log('🔒 Resultado de verificación de contraseña:', passwordMatch);

      if (!passwordMatch) {
        console.log('❌ Contraseña incorrecta');
        return res.status(401).json({ 
          success: false,
          error: "Contraseña incorrecta" 
        });
      }
    } catch (bcryptError) {
      console.error('❌ Error al comparar contraseña:', bcryptError);
      return res.status(500).json({ 
        success: false,
        error: "Error al verificar la contraseña",
        details: process.env.NODE_ENV === 'development' ? bcryptError.message : undefined
      });
    }

    // Usar user.role (no user.rol) para el token
    console.log('🎫 Generando token para usuario:', { id: user.id, role: user.role });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
    console.log('✅ Token generado exitosamente');

    const responseData = {
      success: true,
      message: "Inicio de sesión exitoso",
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        estado: user.estado !== undefined ? user.estado : 1,
        created_at: user.created_at || user.create_at
      },
      // Mantener compatibilidad con código anterior
      usuario: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        estado: user.estado !== undefined ? user.estado : 1,
        created_at: user.created_at || user.create_at
      }
    };

    console.log('✅ Login exitoso, enviando respuesta');
    res.json(responseData);
  } catch (error) {
    console.error('❌ Error en login:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false,
      error: "Error en el servidor",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ⚠️ RUTA DE REGISTRO - También debe ir antes de rutas que requieren token
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;
    console.log("📥 Datos recibidos:", req.body);

    // Verificar si el usuario ya existe
    const [existingUser] = await db.query('SELECT * FROM users WHERE name = ? OR email = ?', [name, email]);
    
    if (existingUser.length > 0) {
      const usuarioExistente = existingUser[0];

      // Si intenta registrar de nuevo al admin ya existente
      if (usuarioExistente.name === 'Padafe65') {
        return res.status(400).json({ message: 'El administrador ya está registrado' });
      }
      if (usuarioExistente.name === name && usuarioExistente.email === email) {
        return res.status(400).json({ message: 'El nombre de usuario y el correo ya están en uso' });
      } else if (usuarioExistente.name === name) {
        return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
      } else if (usuarioExistente.email === email) {
        return res.status(400).json({ message: 'El correo electrónico ya está en uso' });
      }
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Guardar en la base de datos
    const [result] = await db.query(
      "INSERT INTO users (name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)",
      [name, phone, email, hashedPassword, role]
    );

    console.log("✅ Usuario registrado", result);

    // Obtener el usuario recién insertado
    const [userRows] = await db.query('SELECT id, name, phone, email, role FROM users WHERE id = ?', [result.insertId]);
    const newUser = userRows[0];

    // Devolver el usuario completo
    res.status(201).json({
      message: "Usuario registrado con éxito",
      user: newUser
    });

  } catch (error) {
    console.error("❌ Error en el servidor:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ⚠️ AHORA montamos las rutas que requieren autenticación
// Configuración de rutas protegidas (después de rutas públicas de auth)
app.use('/api/students', studentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/questionnaires', questionnaireRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/evaluation-results', evaluationResultsRoutes);
app.use('/api/phase-evaluation', phaseEvaluationRoutes);
app.use('/api/teachers', teachers);
app.use('/api/teacher', teacherRoutes);
app.use('/api/teacher-courses', teacherCoursesRoutes);
app.use('/api/questionnaire-indicators', questionnaireIndicatorsRoutes);
app.use('/api/indicator-evaluation', indicatorEvaluationRoutes);
app.use('/api/indicators', indicatorsRoutes);
app.use('/api', improvementPlansRoutes);
// ⚠️ usersRoutes aplica verifyToken, por eso debe ir DESPUÉS de las rutas públicas de auth
app.use('/api/admin', usersRoutes);  // Cambiado de '/api' a '/api/admin' para evitar conflictos

const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Extrae el token del header

  if (!token) {
    return res.status(401).json({ error: "Acceso denegado: No autenticado" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido" });
    }
    req.usuario_id = decoded.id; // Guarda el ID del usuario en la petición
    next();
  });
};

app.post('/api/auth/reestablecer-password', async (req, res) => {
  const { email, nuevaPassword } = req.body;

  try {
    // Verifica si el usuario existe
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);

    // Actualiza la contraseña
    await db.query("UPDATE users SET password = ? WHERE email = ?", [hashedPassword, email]);

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("❌ Error al reestablecer la contraseña:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para obtener todos los cursos (actualizada para incluir institution y teacher_id si existen)
app.get('/api/courses', async (req, res) => {
  try {
    // Verificar si los campos institution y teacher_id existen en la tabla
    let hasInstitution = false;
    let hasTeacherId = false;
    
    try {
      const [institutionCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = institutionCols.length > 0;
      
      const [teacherIdCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'teacher_id'
      `);
      hasTeacherId = teacherIdCols.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    // Construir query dinámica de forma robusta
    let selectFields = 'c.id, c.name, c.grade';
    if (hasInstitution) {
      selectFields += ', c.institution';
    }
    if (hasTeacherId) {
      selectFields += ', c.teacher_id, u.name as teacher_name';
    }
    
    let query = `SELECT ${selectFields} FROM courses c`;
    if (hasTeacherId) {
      query += ' LEFT JOIN teachers t ON c.teacher_id = t.id LEFT JOIN users u ON t.user_id = u.id';
    }
    query += ' ORDER BY c.name';
    
    console.log('🔍 Query para obtener cursos:', query);
    const [rows] = await pool.query(query);
    console.log(`✅ Se encontraron ${rows.length} cursos`);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener cursos:', error);
    res.status(500).json({ message: 'Error al obtener cursos' });
  }
});

// Rutas CRUD de cursos para super_administrador
// POST - Crear nuevo curso
app.post('/api/courses', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const { name, grade, institution, teacher_id } = req.body;
    
    if (!name || !grade) {
      return res.status(400).json({ 
        success: false,
        message: 'El nombre y el grado son obligatorios' 
      });
    }
    
    // Verificar si el campo institution existe
    let hasInstitution = false;
    let hasTeacherId = false;
    
    try {
      const [institutionCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = institutionCols.length > 0;
      
      const [teacherIdCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'teacher_id'
      `);
      hasTeacherId = teacherIdCols.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    // Construir query dinámica
    let fields = 'name, grade';
    let values = '?, ?';
    let params = [name, grade];
    
    if (hasInstitution && institution) {
      fields += ', institution';
      values += ', ?';
      params.push(institution);
    }
    
    if (hasTeacherId && teacher_id) {
      // Verificar que el teacher_id existe
      const [teacherRows] = await pool.query('SELECT id FROM teachers WHERE id = ?', [teacher_id]);
      if (teacherRows.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'El docente especificado no existe' 
        });
      }
      
      fields += ', teacher_id';
      values += ', ?';
      params.push(teacher_id);
    }
    
    const [result] = await pool.query(
      `INSERT INTO courses (${fields}) VALUES (${values})`,
      params
    );
    
    const courseId = result.insertId;
    
    // Si se asignó un teacher_id, también crear la relación en teacher_courses con role='principal'
    if (hasTeacherId && teacher_id) {
      try {
        // Verificar si el campo role existe en teacher_courses
        let hasRole = false;
        try {
          const [roleCols] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'teacher_courses' 
            AND COLUMN_NAME = 'role'
          `);
          hasRole = roleCols.length > 0;
        } catch (error) {
          // Ignorar error
        }
        
        // Verificar si ya existe la relación
        const [existingRelation] = await pool.query(
          'SELECT * FROM teacher_courses WHERE teacher_id = ? AND course_id = ?',
          [teacher_id, courseId]
        );
        
        if (existingRelation.length === 0) {
          // Crear la relación en teacher_courses con role='principal' si existe el campo
          if (hasRole) {
            await pool.query(
              'INSERT INTO teacher_courses (teacher_id, course_id, assigned_date, role) VALUES (?, ?, NOW(), ?)',
              [teacher_id, courseId, 'principal']
            );
            console.log(`✅ Relación teacher_courses creada con role='principal': teacher_id=${teacher_id}, course_id=${courseId}`);
          } else {
            await pool.query(
              'INSERT INTO teacher_courses (teacher_id, course_id, assigned_date) VALUES (?, ?, NOW())',
              [teacher_id, courseId]
            );
            console.log(`✅ Relación teacher_courses creada: teacher_id=${teacher_id}, course_id=${courseId}`);
          }
        }
      } catch (relError) {
        console.error('⚠️ Error al crear relación en teacher_courses (no crítico):', relError);
        // No fallar la creación del curso si hay error en la relación
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Curso creado exitosamente',
      data: {
        id: courseId,
        name,
        grade,
        institution: hasInstitution ? institution : null,
        teacher_id: hasTeacherId ? teacher_id : null
      }
    });
  } catch (error) {
    console.error('❌ Error al crear curso:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al crear curso',
      error: error.message 
    });
  }
});

// PUT - Actualizar curso existente
app.put('/api/courses/:id', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, grade, institution, teacher_id } = req.body;
    
    // Verificar que el curso existe
    const [existingRows] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Curso no encontrado' 
      });
    }
    
    // Verificar si los campos existen
    let hasInstitution = false;
    let hasTeacherId = false;
    
    try {
      const [institutionCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = institutionCols.length > 0;
      
      const [teacherIdCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'teacher_id'
      `);
      hasTeacherId = teacherIdCols.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    // Construir query de actualización
    let updates = [];
    let params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    
    if (grade !== undefined) {
      updates.push('grade = ?');
      params.push(grade);
    }
    
    if (hasInstitution && institution !== undefined) {
      updates.push('institution = ?');
      params.push(institution || null);
    }
    
    if (hasTeacherId && teacher_id !== undefined) {
      if (teacher_id) {
        // Verificar que el teacher_id existe
        const [teacherRows] = await pool.query('SELECT id FROM teachers WHERE id = ?', [teacher_id]);
        if (teacherRows.length === 0) {
          return res.status(400).json({ 
            success: false,
            message: 'El docente especificado no existe' 
          });
        }
      }
      updates.push('teacher_id = ?');
      params.push(teacher_id || null);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No se proporcionaron campos para actualizar' 
      });
    }
    
    params.push(id);
    
    // Obtener el teacher_id anterior antes de actualizar
    let oldTeacherId = null;
    if (hasTeacherId) {
      const [currentRows] = await pool.query('SELECT teacher_id FROM courses WHERE id = ?', [id]);
      if (currentRows.length > 0) {
        oldTeacherId = currentRows[0].teacher_id;
      }
    }
    
    await pool.query(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Manejar la relación en teacher_courses si el teacher_id cambió
    if (hasTeacherId && teacher_id !== undefined) {
      // Verificar si el campo role existe en teacher_courses
      let hasRole = false;
      try {
        const [roleCols] = await pool.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'teacher_courses' 
          AND COLUMN_NAME = 'role'
        `);
        hasRole = roleCols.length > 0;
      } catch (error) {
        // Ignorar error
      }
      
      const newTeacherId = teacher_id || null;
      
      // Si había un docente anterior y cambió, cambiar su role a 'co-docente' o eliminar relación
      if (oldTeacherId && oldTeacherId !== newTeacherId) {
        try {
          if (hasRole) {
            // Cambiar el role del docente anterior de 'principal' a 'co-docente' (si existe)
            await pool.query(
              'UPDATE teacher_courses SET role = ? WHERE teacher_id = ? AND course_id = ? AND role = ?',
              ['co-docente', oldTeacherId, id, 'principal']
            );
            console.log(`🔄 Role del docente anterior actualizado a 'co-docente': teacher_id=${oldTeacherId}, course_id=${id}`);
          } else {
            // Si no existe role, eliminar la relación antigua
            await pool.query(
              'DELETE FROM teacher_courses WHERE teacher_id = ? AND course_id = ?',
              [oldTeacherId, id]
            );
            console.log(`🗑️ Relación teacher_courses eliminada: teacher_id=${oldTeacherId}, course_id=${id}`);
          }
        } catch (relError) {
          console.error('⚠️ Error al actualizar relación antigua en teacher_courses:', relError);
        }
      }
      
      // Si hay un nuevo docente, crear/actualizar la relación con role='principal'
      if (newTeacherId) {
        try {
          // Verificar si ya existe la relación
          const [existingRelation] = await pool.query(
            'SELECT * FROM teacher_courses WHERE teacher_id = ? AND course_id = ?',
            [newTeacherId, id]
          );
          
          if (existingRelation.length === 0) {
            // Crear nueva relación con role='principal' si existe el campo
            if (hasRole) {
              await pool.query(
                'INSERT INTO teacher_courses (teacher_id, course_id, assigned_date, role) VALUES (?, ?, NOW(), ?)',
                [newTeacherId, id, 'principal']
              );
              console.log(`✅ Relación teacher_courses creada con role='principal': teacher_id=${newTeacherId}, course_id=${id}`);
            } else {
              await pool.query(
                'INSERT INTO teacher_courses (teacher_id, course_id, assigned_date) VALUES (?, ?, NOW())',
                [newTeacherId, id]
              );
              console.log(`✅ Relación teacher_courses creada: teacher_id=${newTeacherId}, course_id=${id}`);
            }
          } else {
            // Si ya existe, actualizar su role a 'principal' si existe el campo
            if (hasRole) {
              await pool.query(
                'UPDATE teacher_courses SET role = ? WHERE teacher_id = ? AND course_id = ?',
                ['principal', newTeacherId, id]
              );
              console.log(`🔄 Role actualizado a 'principal': teacher_id=${newTeacherId}, course_id=${id}`);
            }
          }
        } catch (relError) {
          console.error('⚠️ Error al crear/actualizar relación en teacher_courses:', relError);
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Curso actualizado exitosamente',
      data: { id: parseInt(id), name, grade, institution, teacher_id }
    });
  } catch (error) {
    console.error('❌ Error al actualizar curso:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al actualizar curso',
      error: error.message 
    });
  }
});

// DELETE - Eliminar curso
app.delete('/api/courses/:id', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el curso existe
    const [existingRows] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Curso no encontrado' 
      });
    }
    
    // Verificar si hay estudiantes asignados a este curso
    const [studentsRows] = await pool.query('SELECT COUNT(*) as count FROM students WHERE course_id = ?', [id]);
    if (studentsRows[0].count > 0) {
      return res.status(400).json({ 
        success: false,
        message: `No se puede eliminar el curso porque tiene ${studentsRows[0].count} estudiante(s) asignado(s)` 
      });
    }
    
    // Eliminar todas las relaciones en teacher_courses para este curso
    try {
      await pool.query('DELETE FROM teacher_courses WHERE course_id = ?', [id]);
      console.log(`🗑️ Relaciones teacher_courses eliminadas para course_id=${id}`);
    } catch (relError) {
      console.error('⚠️ Error al eliminar relaciones en teacher_courses (no crítico):', relError);
      // Continuar con la eliminación del curso aunque falle la eliminación de relaciones
    }
    
    // Eliminar el curso
    await pool.query('DELETE FROM courses WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Curso eliminado exitosamente',
      data: { id: parseInt(id) }
    });
  } catch (error) {
    console.error('❌ Error al eliminar curso:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al eliminar curso',
      error: error.message 
    });
  }
});

// Obtener todos los docentes asignados a un curso (con sus roles)
app.get('/api/courses/:id/teachers', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el campo role existe en teacher_courses
    let hasRole = false;
    try {
      const [roleCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'teacher_courses' 
        AND COLUMN_NAME = 'role'
      `);
      hasRole = roleCols.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    let roleField = '';
    if (hasRole) {
      roleField = ', tc.role';
    }
    
    const query = `
      SELECT tc.id, tc.teacher_id, tc.assigned_date${roleField},
             t.subject, u.name as teacher_name, u.email as teacher_email
      FROM teacher_courses tc
      JOIN teachers t ON tc.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE tc.course_id = ?
      ORDER BY ${hasRole ? "tc.role = 'principal' DESC, " : ''}tc.assigned_date DESC
    `;
    
    const [rows] = await pool.query(query, [id]);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener docentes del curso:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener docentes del curso',
      error: error.message 
    });
  }
});

// Agregar docente adicional a un curso
app.post('/api/courses/:id/teachers', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { teacher_id, role } = req.body;
    
    if (!teacher_id) {
      return res.status(400).json({ 
        success: false,
        message: 'Se requiere teacher_id' 
      });
    }
    
    // Verificar que el curso existe
    const [courseRows] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    if (courseRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Curso no encontrado' 
      });
    }
    
    // Verificar que el docente existe
    const [teacherRows] = await pool.query('SELECT id FROM teachers WHERE id = ?', [teacher_id]);
    if (teacherRows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'El docente especificado no existe' 
      });
    }
    
    // Verificar si el campo role existe
    let hasRole = false;
    try {
      const [roleCols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'teacher_courses' 
        AND COLUMN_NAME = 'role'
      `);
      hasRole = roleCols.length > 0;
    } catch (error) {
      // Ignorar error
    }
    
    // Verificar si ya existe la relación
    const [existingRelation] = await pool.query(
      'SELECT * FROM teacher_courses WHERE teacher_id = ? AND course_id = ?',
      [teacher_id, id]
    );
    
    if (existingRelation.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Este docente ya está asignado a este curso' 
      });
    }
    
    // Crear la relación
    const finalRole = hasRole ? (role || 'co-docente') : null;
    if (hasRole && finalRole) {
      await pool.query(
        'INSERT INTO teacher_courses (teacher_id, course_id, assigned_date, role) VALUES (?, ?, NOW(), ?)',
        [teacher_id, id, finalRole]
      );
    } else {
      await pool.query(
        'INSERT INTO teacher_courses (teacher_id, course_id, assigned_date) VALUES (?, ?, NOW())',
        [teacher_id, id]
      );
    }
    
    res.status(201).json({
      success: true,
      message: 'Docente asignado al curso exitosamente',
      data: { teacher_id: parseInt(teacher_id), course_id: parseInt(id), role: finalRole }
    });
  } catch (error) {
    console.error('❌ Error al asignar docente al curso:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al asignar docente al curso',
      error: error.message 
    });
  }
});

// Eliminar docente de un curso
app.delete('/api/courses/:id/teachers/:teacherId', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const { id, teacherId } = req.params;
    
    // Verificar que la relación existe
    const [existingRelation] = await pool.query(
      'SELECT * FROM teacher_courses WHERE teacher_id = ? AND course_id = ?',
      [teacherId, id]
    );
    
    if (existingRelation.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Relación no encontrada' 
      });
    }
    
    // No permitir eliminar el docente principal si está en courses.teacher_id
    const [courseRows] = await pool.query('SELECT teacher_id FROM courses WHERE id = ?', [id]);
    if (courseRows.length > 0 && courseRows[0].teacher_id == teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'No se puede eliminar el docente principal. Primero cambia el docente principal del curso.' 
      });
    }
    
    // Eliminar la relación
    await pool.query(
      'DELETE FROM teacher_courses WHERE teacher_id = ? AND course_id = ?',
      [teacherId, id]
    );
    
    res.json({
      success: true,
      message: 'Docente eliminado del curso exitosamente',
      data: { teacher_id: parseInt(teacherId), course_id: parseInt(id) }
    });
  } catch (error) {
    console.error('❌ Error al eliminar docente del curso:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al eliminar docente del curso',
      error: error.message 
    });
  }
});

// Esta ruta fue movida más arriba (antes de app.use('/api/students', studentRoutes))
// para que tenga prioridad sobre router.post('/', ...) que crea usuarios nuevos
// La ruta para completar datos de estudiante ahora está en la línea ~88
/* Ruta movida arriba
app.post('/api/students', async (req, res) => {
  try {
    const { user_id, name, contact_phone, contact_email, age, grade, course_id, teacher_id } = req.body;
    
    console.log("Datos recibidos para estudiante:", req.body);
    
    // Si no hay user_id pero hay name, crear primero el usuario
    let userId = user_id;
    
    if (!userId && name) {
      // Crear un nuevo usuario con estado 'activo'
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const [userResult] = await db.query(
        'INSERT INTO users (name, email, phone, password, role, estado) VALUES (?, ?, ?, ?, ?, ?)',
        [name, contact_email, contact_phone, hashedPassword, 'estudiante', 'activo']
      );
      
      userId = userResult.insertId;
      console.log("Usuario creado con ID:", userId);
    }
    
    // Verificar que user_id no sea nulo
    if (!userId) {
      return res.status(400).json({ message: 'El campo user_id es obligatorio' });
    }
    
    // Verificar si ya existe un registro de estudiante para este user_id
    const [existingStudent] = await db.query(
      'SELECT id FROM students WHERE user_id = ?',
      [userId]
    );
    
    let studentId;
    
    // Verificar si el campo institution existe en users y students
    let hasInstitution = false;
    try {
      const [columns] = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {
      // Ignorar error, asumir que no existe
    }
    
    // Obtener institution del usuario si existe
    let userInstitution = null;
    if (hasInstitution) {
      try {
        const [userData] = await db.query('SELECT institution FROM users WHERE id = ?', [userId]);
        userInstitution = userData.length > 0 ? userData[0].institution : null;
      } catch (error) {
        // Ignorar error
      }
    }
    
    if (existingStudent.length > 0) {
      // Si ya existe, actualizar el registro existente
      studentId = existingStudent[0].id;
      if (hasInstitution) {
        await db.query(
          'UPDATE students SET contact_phone = ?, contact_email = ?, age = ?, grade = ?, course_id = ?, institution = ? WHERE id = ?',
          [contact_phone, contact_email, age, grade, course_id, userInstitution, studentId]
        );
      } else {
        await db.query(
          'UPDATE students SET contact_phone = ?, contact_email = ?, age = ?, grade = ?, course_id = ? WHERE id = ?',
          [contact_phone, contact_email, age, grade, course_id, studentId]
        );
      }
    } else {
      // Si no existe, crear nuevo registro
      if (hasInstitution) {
        const [result] = await db.query(
          'INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id, institution) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, contact_phone, contact_email, age, grade, course_id, userInstitution]
        );
        studentId = result.insertId;
      } else {
        const [result] = await db.query(
          'INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, contact_phone, contact_email, age, grade, course_id]
        );
        studentId = result.insertId;
      }
    }
    
    // Verificar que studentId esté definido
    if (!studentId) {
      console.error('❌ studentId no está definido después de crear/actualizar estudiante');
      return res.status(500).json({ message: 'Error: No se pudo obtener el ID del estudiante' });
    }
    
    // Si se proporcionó un teacher_id, crear/actualizar la relación en teacher_students
    if (teacher_id) {
      try {
        console.log(`🔗 Creando relación teacher_students: teacher_id=${teacher_id}, student_id=${studentId}`);
        
        // Eliminar relaciones existentes primero
        await db.query(
          'DELETE FROM teacher_students WHERE student_id = ?',
          [studentId]
        );
        
        // Crear nueva relación
        await db.query(
          'INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)',
          [teacher_id, studentId]
        );
        
        console.log(`✅ Relación teacher_students creada exitosamente`);
      } catch (relError) {
        console.error('❌ Error al crear relación teacher_students:', relError);
        // Si es error de duplicado, no es crítico - continuar
        if (relError.code !== 'ER_DUP_ENTRY') {
          throw relError; // Re-lanzar si no es duplicado
        }
        console.log('⚠️ Relación ya existía, continuando...');
      }
    }
    
    console.log(`✅ Estudiante ${existingStudent.length > 0 ? 'actualizado' : 'creado'} exitosamente con ID: ${studentId}`);
    
    res.status(201).json({ 
      message: existingStudent.length > 0 ? 'Datos de estudiante actualizados correctamente' : 'Estudiante registrado correctamente', 
      studentId: studentId 
    });
  } catch (error) {
    console.error('❌ Error registrando estudiante:', error);
    console.error('📌 Stack trace:', error.stack);
    console.error('📌 Error code:', error.code);
    console.error('📌 Error message:', error.message);
    console.error('📌 SQL State:', error.sqlState);
    console.error('📌 Request body:', req.body);
    
    // Si es error de duplicado en teacher_students, ignorarlo y continuar
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('⚠️ Error de duplicado detectado, pero continuando...');
      // Intentar obtener studentId si está disponible
      let existingStudentId;
      if (req.body.user_id) {
        try {
          const [existing] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.body.user_id]);
          if (existing.length > 0) {
            existingStudentId = existing[0].id;
          }
        } catch (e) {
          // Ignorar
        }
      }
      return res.status(201).json({ 
        message: 'Estudiante registrado correctamente (relación con profesor ya existía)', 
        studentId: existingStudentId 
      });
    }
    
    res.status(500).json({ 
      message: 'Error al registrar estudiante', 
      error: error.message,
      sqlError: error.sqlMessage || undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
*/
// Ruta para obtener todos los estudiantes (pública para compatibilidad, pero se recomienda usar el router)
// Esta ruta se usa como fallback si el router no está funcionando correctamente
app.get('/api/students', async (req, res) => {
  try {
    console.log('📋 [GET] /api/students - Ruta directa (sin autenticación)');
    const [rows] = await db.query(`
      SELECT 
        s.id, s.user_id, s.contact_phone, s.contact_email, s.age, s.grade, s.course_id,
        u.name, u.email, u.phone, u.role, u.created_at,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
    `);
    console.log(`✅ ${rows.length} estudiantes encontrados`);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener estudiantes:', error);
    res.status(500).json({ message: 'Error al obtener estudiantes' });
  }
});

// Ruta para obtener estudiantes con datos completos (para el dashboard del docente)
app.get('/api/students/complete', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        s.id, s.user_id, s.contact_phone, s.contact_email, s.age, s.grade, s.course_id,
        u.name, u.email, u.phone, u.role, u.created_at,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener estudiantes:', error);
    res.status(500).json({ message: 'Error al obtener estudiantes' });
  }
});

// server.js (fragmento con la nueva ruta)

// Ruta para obtener un estudiante específico por ID
app.get('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si institution existe antes de incluirla
    let hasInstitution = false;
    try {
      const [columns] = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'students' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {
      // Ignorar
    }
    
    const institutionFields = hasInstitution 
      ? 's.institution, u.institution as user_institution, ' 
      : '';
    
    const [rows] = await db.query(`
      SELECT 
        s.id, s.user_id, s.contact_phone, s.contact_email, s.age, s.grade, s.course_id, ${institutionFields}
        u.name, u.email, u.phone, u.role,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error al obtener estudiante:', error);
    res.status(500).json({ message: 'Error al obtener estudiante' });
  }
});

// Ruta para obtener estudiante por user_id (útil para completar registros)
app.get('/api/students/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar si institution existe
    let hasInstitution = false;
    try {
      const [columns] = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'students' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {
      // Ignorar
    }
    
    const institutionFields = hasInstitution 
      ? 's.institution, u.institution as user_institution, ' 
      : '';
    
    const [rows] = await db.query(`
      SELECT 
        s.id, s.user_id, s.contact_phone, s.contact_email, s.age, s.grade, s.course_id, ${institutionFields}
        u.name, u.email, u.phone, u.role,
        c.name as course_name,
        (SELECT teacher_id FROM teacher_students WHERE student_id = s.id LIMIT 1) as teacher_id
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.user_id = ?
    `, [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado para este usuario' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error al obtener estudiante por user_id:', error);
    res.status(500).json({ message: 'Error al obtener estudiante' });
  }
});

// Ruta para obtener la institución de un usuario (útil cuando aún no hay registro de estudiante)
app.get('/api/users/:userId/institution', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar si institution existe
    let hasInstitution = false;
    try {
      const [columns] = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'institution'
      `);
      hasInstitution = columns.length > 0;
    } catch (error) {
      // Ignorar
    }
    
    if (!hasInstitution) {
      return res.json({ institution: null });
    }
    
    const [rows] = await db.query(
      'SELECT institution FROM users WHERE id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json({ institution: rows[0].institution || null });
  } catch (error) {
    console.error('❌ Error al obtener institución del usuario:', error);
    res.status(500).json({ message: 'Error al obtener institución' });
  }
});

// Ruta para obtener usuarios con registros incompletos (estudiantes sin datos en tabla students)
app.get('/api/users/incomplete/students', async (req, res) => {
  try {
    console.log('📋 [GET] /api/users/incomplete/students - Obteniendo estudiantes incompletos');
    const [rows] = await db.query(`
      SELECT 
        u.id, u.name, u.email, u.phone, u.role, u.created_at, u.estado
      FROM users u
      WHERE u.role = 'estudiante'
      AND NOT EXISTS (
        SELECT 1 FROM students s WHERE s.user_id = u.id
      )
      ORDER BY u.created_at DESC
    `);
    
    console.log(`✅ Se encontraron ${rows.length} estudiantes con registro incompleto`);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener usuarios incompletos:', error);
    res.status(500).json({ message: 'Error al obtener usuarios incompletos', error: error.message });
  }
});

// Ruta para obtener usuarios con registros incompletos (docentes sin datos en tabla teachers)
app.get('/api/users/incomplete/teachers', async (req, res) => {
  try {
    console.log('📋 [GET] /api/users/incomplete/teachers - Obteniendo docentes incompletos');
    const [rows] = await db.query(`
      SELECT 
        u.id, u.name, u.email, u.phone, u.role, u.created_at, u.estado
      FROM users u
      WHERE u.role = 'docente'
      AND NOT EXISTS (
        SELECT 1 FROM teachers t WHERE t.user_id = u.id
      )
      ORDER BY u.created_at DESC
    `);
    
    console.log(`✅ Se encontraron ${rows.length} docentes con registro incompleto`);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener usuarios incompletos:', error);
    res.status(500).json({ message: 'Error al obtener usuarios incompletos', error: error.message });
  }
});

// Ruta para actualizar datos de estudiante
app.put('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { contact_phone, contact_email, age, grade, course_id, name, email, phone, teacher_id } = req.body;

    // Obtener el user_id del estudiante
    const [studentRows] = await db.query(
      'SELECT user_id FROM students WHERE id = ?',
      [id]
    );
    
    if (studentRows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    const userId = studentRows[0].user_id;
    
    // Actualizar datos en la tabla users
    await db.query(
      'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name, email, phone, userId]
    );
    
    // Verificar si el campo institution existe
    let hasInstitution = false;
    try {
      const [columns] = await db.query(`
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
    
    // Obtener institution del usuario para sincronizar con students
    let userInstitution = null;
    if (hasInstitution) {
      try {
        const [currentUser] = await db.query('SELECT institution FROM users WHERE id = ?', [userId]);
        userInstitution = currentUser.length > 0 ? currentUser[0].institution : null;
      } catch (error) {
        // Ignorar error
      }
    }
    
    // Actualizar datos en la tabla students
    if (hasInstitution) {
      await db.query(
        'UPDATE students SET contact_phone = ?, contact_email = ?, age = ?, grade = ?, course_id = ?, institution = ? WHERE id = ?',
        [contact_phone, contact_email, age, grade, course_id, userInstitution, id]
      );
    } else {
      await db.query(
        'UPDATE students SET contact_phone = ?, contact_email = ?, age = ?, grade = ?, course_id = ? WHERE id = ?',
        [contact_phone, contact_email, age, grade, course_id, id]
      );
    }
    
    // Si se proporcionó un teacher_id, actualizar la relación en teacher_students
    if (teacher_id) {
      // Verificar si ya existe una relación
      const [existingRelation] = await db.query(
        'SELECT * FROM teacher_students WHERE student_id = ?',
        [id]
      );
      
      if (existingRelation.length > 0) {
        // Actualizar la relación existente
        await db.query(
          'UPDATE teacher_students SET teacher_id = ? WHERE student_id = ?',
          [teacher_id, id]
        );
      } else {
        // Crear una nueva relación
        await db.query(
          'INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)',
          [teacher_id, id]
        );
      }
    }
    
    res.json({ message: 'Datos de estudiante actualizados correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar estudiante:', error);
    res.status(500).json({ message: 'Error al actualizar estudiante' });
  }
});

// Ruta para eliminar estudiante
app.delete('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener el user_id del estudiante
    const [studentRows] = await db.query(
      'SELECT user_id FROM students WHERE id = ?',
      [id]
    );
    
    if (studentRows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    const userId = studentRows[0].user_id;
    
    // Eliminar relaciones en teacher_students
    await db.query('DELETE FROM teacher_students WHERE student_id = ?', [id]);
    
    // Eliminar estudiante
    await db.query('DELETE FROM students WHERE id = ?', [id]);
    
    // Eliminar usuario asociado
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    
    res.json({ message: 'Estudiante eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar estudiante:', error);
    res.status(500).json({ message: 'Error al eliminar estudiante' });
  }
});

// Añadir esta ruta a tu server.js si no existe
// Ruta para obtener un estudiante por user_id
app.get('/api/students/by-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [rows] = await db.query(`
      SELECT 
        s.id, s.user_id, s.contact_phone, s.contact_email, s.age, s.grade, s.course_id,
        u.name, u.email, u.phone, u.role,
        c.name as course_name,
        g.phase1, g.phase2, g.phase3, g.phase4, g.average
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN grades g ON s.id = g.student_id
      WHERE s.user_id = ?
    `, [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error al obtener estudiante:', error);
    res.status(500).json({ message: 'Error al obtener estudiante' });
  }
});

// Agregar esta ruta en server.js
app.get('/api/student/attempts/:student_id', async (req, res) => {
  const { student_id } = req.params;

  try {
    // Obtener el ID del estudiante (real)
    const [studentRows] = await db.query(
      'SELECT id FROM students WHERE user_id = ?',
      [student_id]
    );

    if (studentRows.length === 0) {
      return res.json([]);
    }

    const realStudentId = studentRows[0].id;

    // Consulta mejorada
    const [rows] = await db.query(`
      SELECT 
        qa.id as attempt_id,
        qa.attempt_number, 
        qa.score, 
        qa.attempt_date as attempted_at,
        q.id as questionnaire_id,
        q.title,
        q.category,
        q.phase,
        u.name AS teacher_name,
        c.name AS course_name,
        (
          SELECT COUNT(*) 
          FROM quiz_attempts 
          WHERE student_id = qa.student_id 
            AND questionnaire_id = qa.questionnaire_id
        ) AS total_attempts
      FROM quiz_attempts qa
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      JOIN users u ON q.created_by = u.id
      JOIN courses c ON q.course_id = c.id
      WHERE qa.student_id = ?
      ORDER BY qa.attempt_date DESC
    `, [realStudentId]);

    // Agregar subject_name si quieres mantenerlo
    const processedRows = rows.map(row => ({
      ...row,
      subject_name: row.category?.split('_')[1] || ''
    }));

    res.json(processedRows);

  } catch (err) {
    console.error('❌ Error al obtener intentos detallados:', err);
    res.status(500).json({ error: 'Error al obtener intentos detallados' });
  }
});

// Ruta para obtener categorías por materia
// Ruta para obtener categorías por materia - Enfoque general
app.get('/api/categories/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    
    console.log("Buscando categorías para materia:", subject);
    
    // 1. Intentar buscar exactamente como viene
    let [rows] = await db.query(
      'SELECT * FROM subject_categories WHERE subject = ?',
      [subject]
    );
    
    // 2. Si no hay resultados, intentar normalizar (quitar tildes)
    if (rows.length === 0) {
      const normalizedSubject = subject
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Quita tildes
      
      [rows] = await db.query(
        'SELECT * FROM subject_categories WHERE subject = ?',
        [normalizedSubject]
      );
    }
    
    // 3. Si aún no hay resultados, buscar con LIKE para coincidencias parciales
    if (rows.length === 0) {
      [rows] = await db.query(
        'SELECT * FROM subject_categories WHERE subject LIKE ?',
        [`%${subject}%`]
      );
    }
    
    // 4. Si todavía no hay resultados, devolver categorías genéricas
    if (rows.length === 0) {
      console.log(`No se encontraron categorías para ${subject}, devolviendo predeterminadas`);
      return res.json([
        { category: `${subject}_Teoría` },
        { category: `${subject}_Práctica` },
        { category: `${subject}_Evaluación` }
      ]);
    }
    
    console.log(`Se encontraron ${rows.length} categorías para ${subject}`);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener categorías:', error);
    res.status(500).json({ message: 'Error al obtener categorías' });
  }
});

// Ruta para crear una nueva materia
app.post('/api/subjects', async (req, res) => {
  try {
    const { subject } = req.body;
    
    // Verificar si la materia ya existe
    const [existingRows] = await pool.query(
      'SELECT * FROM subject_categories WHERE subject = ?',
      [subject]
    );
    
    if (existingRows.length > 0) {
      return res.status(400).json({ message: 'Esta materia ya existe' });
    }
    
    // Insertar la materia con una categoría predeterminada
    const [result] = await pool.query(
      'INSERT INTO subject_categories (subject, category) VALUES (?, ?)',
      [subject, `${subject}_General`]
    );
    
    res.status(201).json({
      id: result.insertId,
      subject,
      category: `${subject}_General`
    });
  } catch (error) {
    console.error('❌ Error al crear materia:', error);
    res.status(500).json({ message: 'Error al crear materia' });
  }
});

// Ruta para obtener todas las categorías
app.get('/api/all-categories', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM subject_categories ORDER BY subject, category'
    );
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener todas las categorías:', error);
    res.status(500).json({ message: 'Error al obtener todas las categorías' });
  }
});

// Ruta para obtener todas las materias disponibles
app.get('/api/subjects', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT subject FROM subject_categories ORDER BY subject'
    );
    
    res.json(rows.map(row => row.subject));
  } catch (error) {
    console.error('❌ Error al obtener materias:', error);
    res.status(500).json({ message: 'Error al obtener materias' });
  }
});

// Ruta para obtener la materia del docente
app.get('/api/teacher/subject/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [rows] = await pool.query(
      'SELECT subject FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }
    
    res.json({ subject: rows[0].subject });
  } catch (error) {
    console.error('❌ Error al obtener materia del docente:', error);
    res.status(500).json({ message: 'Error al obtener materia del docente' });
  }
});

// Ruta para obtener todas las materias disponibles (DEBE IR ANTES de la ruta con :subject)
app.get('/api/subject-categories-list/subjects', async (req, res) => {
  try {
    // Obtener todas las materias únicas de la tabla subject_categories
    const [rows] = await pool.query(
      'SELECT DISTINCT subject FROM subject_categories ORDER BY subject'
    );
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener materias:', error);
    res.status(500).json({ message: 'Error al obtener materias' });
  }
});

// Ruta para obtener categorías por materia
app.get('/api/subject-categories/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    
    // Si la materia es "Matemàticas", buscar como "Matematicas" (sin tilde)
    const searchSubject = subject === 'Matemáticas' ? 'Matematicas' : subject;
    
    // Consulta directa a la tabla subject_categories
    const [rows] = await pool.query(
      'SELECT * FROM subject_categories WHERE subject = ?',
      [searchSubject]
    );
    
    // Si no hay categorías para esta materia, devolver categorías predeterminadas
    if (rows.length === 0) {
      return res.json([
        { id: 1, subject: searchSubject, category: `${searchSubject}_Categoria1` },
        { id: 2, subject: searchSubject, category: `${searchSubject}_Categoria2` }
      ]);
    }
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener categorías:', error);
    res.status(500).json({ message: 'Error al obtener categorías' });
  }
});

// Ruta para crear una nueva categoría
app.post('/api/subject-categories', async (req, res) => {
  try {
    const { subject, category } = req.body;
    
    // Verificar si la categoría ya existe
    const [existingRows] = await pool.query(
      'SELECT * FROM subject_categories WHERE subject = ? AND category = ?',
      [subject, category]
    );
    
    if (existingRows.length > 0) {
      return res.status(400).json({ message: 'Esta categoría ya existe' });
    }
    
    // Insertar la nueva categoría
    const [result] = await pool.query(
      'INSERT INTO subject_categories (subject, category) VALUES (?, ?)',
      [subject, category]
    );
    
    res.status(201).json({
      id: result.insertId,
      subject,
      category
    });
  } catch (error) {
    console.error('❌ Error al crear categoría:', error);
    res.status(500).json({ message: 'Error al crear categoría' });
  }
});

// Ruta para actualizar una categoría
app.put('/api/subject-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, category } = req.body;
    
    if (!subject || !category) {
      return res.status(400).json({ message: 'Se requiere subject y category' });
    }
    
    // Verificar si la categoría existe
    const [existingRows] = await pool.query(
      'SELECT * FROM subject_categories WHERE id = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    
    // Verificar si ya existe otra categoría con el mismo subject y category
    const [duplicateRows] = await pool.query(
      'SELECT * FROM subject_categories WHERE subject = ? AND category = ? AND id != ?',
      [subject, category, id]
    );
    
    if (duplicateRows.length > 0) {
      return res.status(400).json({ message: 'Ya existe otra categoría con estos valores' });
    }
    
    // Actualizar la categoría
    await pool.query(
      'UPDATE subject_categories SET subject = ?, category = ? WHERE id = ?',
      [subject, category, id]
    );
    
    res.json({
      id: parseInt(id),
      subject,
      category,
      message: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al actualizar categoría:', error);
    res.status(500).json({ message: 'Error al actualizar categoría' });
  }
});

// Ruta para eliminar una categoría
app.delete('/api/subject-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si la categoría existe
    const [existingRows] = await pool.query(
      'SELECT * FROM subject_categories WHERE id = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    
    // Eliminar la categoría
    await pool.query(
      'DELETE FROM subject_categories WHERE id = ?',
      [id]
    );
    
    res.json({
      message: 'Categoría eliminada exitosamente',
      id: parseInt(id)
    });
  } catch (error) {
    console.error('❌ Error al eliminar categoría:', error);
    res.status(500).json({ message: 'Error al eliminar categoría' });
  }
});

// Ruta para obtener todas las materias y categorías (completo)
app.get('/api/subject-categories-all', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM subject_categories ORDER BY subject, category'
    );
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener todas las materias y categorías:', error);
    res.status(500).json({ message: 'Error al obtener materias y categorías' });
  }
});

// Ruta para obtener el ID del profesor por ID de usuario
app.get('/api/teachers/by-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [rows] = await pool.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    res.json({ id: rows[0].id });
  } catch (error) {
    console.error('❌ Error al obtener profesor:', error);
    res.status(500).json({ message: 'Error al obtener profesor' });
  }
});

// Obtener preguntas con filtros múltiples (questionnaire_id, created_by, subject)
app.get('/api/questions', async (req, res) => {
  try {
    const { questionnaire_id, created_by, subject } = req.query;
    
    let query = 'SELECT q.*, qn.title as questionnaire_title FROM questions q LEFT JOIN questionnaires qn ON q.questionnaire_id = qn.id WHERE 1=1';
    let params = [];
    
    if (questionnaire_id) {
      query += ' AND q.questionnaire_id = ?';
      params.push(questionnaire_id);
    }
    
    if (created_by) {
      query += ' AND qn.created_by = ?';
      params.push(created_by);
    }
    
    if (subject) {
      query += ' AND (q.category LIKE ? OR qn.category LIKE ?)';
      params.push(`${subject}_%`, `${subject}_%`);
    }
    
    query += ' ORDER BY q.id DESC';
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener preguntas:', error);
    res.status(500).json({ message: 'Error al obtener preguntas' });
  }
});

// Obtener estudiantes de un profesor específico - MODIFICADA
app.get('/api/teacher/students/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Primero obtener el teacher_id a partir del user_id
    const [teacherRows] = await pool.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [userId]
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    const teacherId = teacherRows[0].id;
    
    // Ahora obtener los estudiantes asociados a ese teacher_id
    const [rows] = await pool.query(`
      SELECT s.*, c.name as course_name, u.name, u.email, u.phone
      FROM teacher_students ts
      JOIN students s ON ts.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN courses c ON s.course_id = c.id
      WHERE ts.teacher_id = ?
    `, [teacherId]);
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener estudiantes del profesor:', error);
    res.status(500).json({ message: 'Error al obtener estudiantes del profesor' });
  }
});

// Obtener calificaciones por fase de los estudiantes de un docente
app.get('/api/teacher/student-grades/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    // Obtener el ID real del profesor
    const [teacherRows] = await pool.query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [teacherId]
    );
    
    if (teacherRows.length === 0) {
      return res.json([]);
    }
    
    const realTeacherId = teacherRows[0].id;
    
    // Obtener calificaciones de los estudiantes asignados al profesor
    const [rows] = await pool.query(`
      SELECT DISTINCT
        s.id as student_id, 
        s.user_id,
        u.name as student_name,
        c.name as course_name,
        g.phase1, 
        g.phase2, 
        g.phase3, 
        g.phase4,
        g.average
      FROM teacher_students ts
      JOIN students s ON ts.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN courses c ON s.course_id = c.id
      LEFT JOIN grades g ON s.id = g.student_id
      WHERE ts.teacher_id = ?
      ORDER BY u.name
    `, [realTeacherId]);
    
    console.log(`📊 Calificaciones obtenidas para el profesor ${realTeacherId}:`, JSON.stringify(rows, null, 2));
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener calificaciones:', error);
    res.status(500).json({ message: 'Error al obtener calificaciones' });
  }
});

// Obtener detalles de un intento de quiz específico
app.get('/api/quiz-attempts/:id', async (req, res) => {
  try {
    const [attempts] = await pool.query(`
      SELECT qa.*,
             u.name as student_name,
             q.title as questionnaire_title
      FROM quiz_attempts qa
      JOIN students st ON qa.student_id = st.id
      JOIN users u ON st.user_id = u.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      WHERE qa.id = ?
    `, [req.params.id]);
    
    if (attempts.length === 0) {
      return res.status(404).json({ message: 'Intento no encontrado' });
    }
    
    res.json(attempts[0]);
  } catch (error) {
    console.error('Error al obtener detalles del intento:', error);
    res.status(500).json({ message: 'Error al obtener detalles del intento' });
  }
});

// Obtener todos los intentos de un estudiante para un cuestionario específico
app.get('/api/quiz-attempts/student/:studentId/questionnaire/:questionnaireId', async (req, res) => {
  try {
    const { studentId, questionnaireId } = req.params;
    
    const [attempts] = await pool.query(`
      SELECT qa.*,
             u.name as student_name,
             q.title as questionnaire_title
      FROM quiz_attempts qa
      JOIN students st ON qa.student_id = st.id
      JOIN users u ON st.user_id = u.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      WHERE qa.student_id = ? AND qa.questionnaire_id = ?
      ORDER BY qa.attempt_number ASC
    `, [studentId, questionnaireId]);
    
    console.log(`🎯 Intentos encontrados para estudiante ${studentId} y cuestionario ${questionnaireId}:`, attempts);
    res.json(attempts);
  } catch (error) {
    console.error('Error al obtener intentos del estudiante:', error);
    res.status(500).json({ message: 'Error al obtener intentos del estudiante' });
  }
});

// Obtener todos los intentos de un estudiante
app.get('/api/quiz-attempts/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const [attempts] = await pool.query(`
      SELECT qa.*,
             u.name as student_name,
             q.title as questionnaire_title
      FROM quiz_attempts qa
      JOIN students st ON qa.student_id = st.id
      JOIN users u ON st.user_id = u.id
      JOIN questionnaires q ON qa.questionnaire_id = q.id
      WHERE qa.student_id = ?
      ORDER BY qa.questionnaire_id, qa.attempt_number ASC
    `, [studentId]);
    
    console.log(`🎯 Todos los intentos encontrados para estudiante ${studentId}:`, attempts);
    res.json(attempts);
  } catch (error) {
    console.error('Error al obtener todos los intentos del estudiante:', error);
    res.status(500).json({ message: 'Error al obtener intentos del estudiante' });
  }
});

// Obtener cursos asignados a un profesor
app.get('/api/teachers/:id/courses', async (req, res) => {
  try {
    const [courses] = await pool.query(`
      SELECT DISTINCT c.*
      FROM courses c
      JOIN students s ON c.id = s.course_id
      JOIN teacher_students ts ON s.id = ts.student_id
      WHERE ts.teacher_id = ?
    `, [req.params.id]);
    
    res.json(courses);
  } catch (error) {
    console.error('Error al obtener cursos del profesor:', error);
    res.status(500).json({ message: 'Error al obtener cursos del profesor' });
  }
});

// Obtener notas de un estudiante
app.get('/api/students/:studentId/grades', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    console.log(`📊 Solicitud de notas para estudiante ${studentId}`);
    
    const [grades] = await pool.query(`
      SELECT g.*, q.title as questionnaire_title
      FROM grades g
      LEFT JOIN questionnaires q ON g.questionnaire_id = q.id
      WHERE g.student_id = ?
      ORDER BY g.created_at DESC
    `, [studentId]);
    
    console.log(`📊 Notas obtenidas para estudiante ${studentId}:`, grades);
    res.json(grades);
  } catch (error) {
    console.error('Error al obtener notas del estudiante:', error);
    res.status(500).json({ message: 'Error al obtener notas del estudiante' });
  }
});

// Actualizar notas de un estudiante
app.put('/api/students/:studentId/grades', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { phase1, phase2, phase3, phase4, average } = req.body;
    
    console.log(`📝 Actualizando notas para estudiante ${studentId}:`, req.body);
    
    // Buscar si ya existe un registro de notas para este estudiante
    const [existingGrades] = await pool.query(`
      SELECT id FROM grades WHERE student_id = ?
    `, [studentId]);
    
    if (existingGrades.length > 0) {
      // Actualizar notas existentes
      await pool.query(`
        UPDATE grades 
        SET phase1 = ?, phase2 = ?, phase3 = ?, phase4 = ?, average = ?
        WHERE student_id = ?
      `, [phase1, phase2, phase3, phase4, average, studentId]);
    } else {
      // Crear nuevo registro de notas
      await pool.query(`
        INSERT INTO grades (student_id, phase1, phase2, phase3, phase4, average, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [studentId, phase1, phase2, phase3, phase4, average]);
    }
    
    // Actualizar phase_averages si hay notas válidas
    // Recalcular automáticamente phase_averages basándose en evaluation_results
    try {
      console.log(`🔄 Iniciando recálculo automático para estudiante ${studentId}...`);
      const result = await recalculatePhaseAverages(studentId);
      if (result.success) {
        console.log(`✅ Phase averages recalculadas automáticamente para estudiante ${studentId}:`, result);
      } else {
        console.error(`❌ Error en recálculo automático para estudiante ${studentId}:`, result.error);
      }
    } catch (error) {
      console.error('❌ Error crítico al recalcular phase_averages automáticamente:', error);
      // No interrumpir el flujo principal si hay error en el recálculo automático
    }
    
    console.log(`✅ Notas actualizadas exitosamente para estudiante ${studentId}`);
    res.json({ success: true, message: 'Notas actualizadas correctamente' });
    
  } catch (error) {
    console.error('Error al actualizar notas del estudiante:', error);
    res.status(500).json({ message: 'Error al actualizar notas del estudiante' });
  }
});

// Actualizar un intento de quiz específico
app.put('/api/quiz-attempts/:attemptId', verifyToken, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { score } = req.body;
    
    console.log(`📝 Actualizando intento ${attemptId} con puntaje ${score}`);
    
    await pool.query(`
      UPDATE quiz_attempts 
      SET score = ?, attempt_date = NOW()
      WHERE id = ?
    `, [score, attemptId]);
    
    // Obtener información del intento actualizado
    const [updatedAttempt] = await pool.query(`
      SELECT qa.*, s.id as student_id
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      WHERE qa.id = ?
    `, [attemptId]);
    
    if (updatedAttempt.length > 0) {
      const attempt = updatedAttempt[0];
      
      // Actualizar evaluation_results si existe
      await pool.query(`
        UPDATE evaluation_results 
        SET best_score = (
          SELECT MAX(score) FROM quiz_attempts 
          WHERE student_id = ? AND questionnaire_id = ?
        ),
        min_score = (
          SELECT MIN(score) FROM quiz_attempts 
          WHERE student_id = ? AND questionnaire_id = ?
        )
        WHERE student_id = ? AND questionnaire_id = ?
      `, [attempt.student_id, attempt.questionnaire_id, attempt.student_id, attempt.questionnaire_id, attempt.student_id, attempt.questionnaire_id]);
      
      // Recalcular automáticamente phase_averages después de actualizar intentos
      try {
        console.log(`🔄 Iniciando recálculo automático para estudiante ${attempt.student_id}...`);
        const result = await recalculatePhaseAverages(attempt.student_id);
        if (result.success) {
          console.log(`✅ Phase averages recalculadas automáticamente después de actualizar intento para estudiante ${attempt.student_id}:`, result);
        } else {
          console.error(`❌ Error en recálculo automático para estudiante ${attempt.student_id}:`, result.error);
        }
      } catch (error) {
        console.error('❌ Error crítico al recalcular phase_averages después de actualizar intento:', error);
        // No interrumpir el flujo principal si hay error en el recálculo automático
      }
    }
    
    console.log(`✅ Intento ${attemptId} actualizado exitosamente`);
    res.json({ success: true, message: 'Intento actualizado correctamente' });
    
  } catch (error) {
    console.error('Error al actualizar intento:', error);
    res.status(500).json({ message: 'Error al actualizar intento' });
  }
});

// Asignar estudiante a profesor - MODIFICADA
app.post('/api/teacher/assign-student', async (req, res) => {
  try {
    let { teacher_id, student_id, user_id } = req.body;
    
    // Si se proporciona user_id en lugar de teacher_id, obtener el teacher_id
    if (!teacher_id && user_id) {
      const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [user_id]
      );
      
      if (teacherRows.length === 0) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      teacher_id = teacherRows[0].id;
    }
    
    // Verificar si ya existe la relación
    const [existingRows] = await pool.query(
      'SELECT * FROM teacher_students WHERE student_id = ?',
      [student_id]
    );
    
    if (existingRows.length > 0) {
      // Actualizar la relación existente
      await pool.query(
        'UPDATE teacher_students SET teacher_id = ? WHERE student_id = ?',
        [teacher_id, student_id]
      );
    } else {
      // Crear la relación
      await pool.query(
        'INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)',
        [teacher_id, student_id]
      );
    }
    
    res.status(201).json({ message: 'Estudiante asignado correctamente al profesor' });
  } catch (error) {
    console.error('❌ Error al asignar estudiante:', error);
    res.status(500).json({ message: 'Error al asignar estudiante' });
  }
});

// Desasignar estudiante de profesor
app.delete('/api/teacher/unassign-student', async (req, res) => {
  try {
    const { teacher_id, student_id } = req.body;
    
    await pool.query(
      'DELETE FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
      [teacher_id, student_id]
    );
    
    res.json({ message: 'Estudiante desasignado correctamente del profesor' });
  } catch (error) {
    console.error('❌ Error al desasignar estudiante:', error);
    res.status(500).json({ message: 'Error al desasignar estudiante' });
  }
});

// Eliminar todas las relaciones teacher_students para un estudiante
app.delete('/api/teacher/student/:studentId/teacher', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    console.log(`🗑️ Eliminando relaciones teacher_students para student_id: ${studentId}`);
    
    const [result] = await db.query(
      'DELETE FROM teacher_students WHERE student_id = ?',
      [studentId]
    );
    
    console.log(`✅ Relaciones eliminadas: ${result.affectedRows}`);
    
    res.json({ 
      message: 'Relaciones eliminadas correctamente',
      deletedRows: result.affectedRows
    });
  } catch (error) {
    console.error('❌ Error al eliminar relaciones teacher_students:', error);
    res.status(500).json({ message: 'Error al eliminar relaciones' });
  }
});

// NUEVAS RUTAS PARA SOLUCIONAR EL ERROR 404
// Ruta para obtener los mejores resultados de evaluación para un estudiante (evaluation_results)
app.get('/api/student/evaluation-results/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Obtener el ID real del estudiante
    const [studentRows] = await pool.query(
      'SELECT id FROM students WHERE user_id = ?',
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.json([]);
    }

    const realStudentId = studentRows[0].id;

    // Consulta para obtener los mejores resultados con información adicional
    const [rows] = await pool.query(`
      SELECT 
        er.id,
        er.student_id,
        er.questionnaire_id,
        er.best_score,
        er.selected_attempt_id,
        er.phase,
        er.recorded_at,
        q.title,
        q.category,
        qa.attempt_number
      FROM evaluation_results er
      JOIN questionnaires q ON er.questionnaire_id = q.id
      JOIN quiz_attempts qa ON er.selected_attempt_id = qa.id
      WHERE er.student_id = ?
      ORDER BY er.phase, er.recorded_at DESC
    `, [realStudentId]);

    // Agregar subject_name si es necesario
    const processedRows = rows.map(row => ({
      ...row,
      subject_name: row.category?.split('_')[1] || ''
    }));

    res.json(processedRows);
  } catch (error) {
    console.error('Error al obtener resultados de evaluación:', error);
    res.status(500).json({ error: 'Error al obtener resultados de evaluación' });
  }
});

// La ruta /api/teachers/list ahora está definida en routes/teachers.js
// para evitar que sea capturada por router.get('/:id') antes de llegar aquí
// Esta ruta duplicada se ha eliminado y ahora se usa la del router
/* Ruta movida a routes/teachers.js
app.get('/api/teachers/list', async (req, res) => {
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
    let hasJoin = false;
    let hasCoursesJoin = false;
    
    // Si se proporciona course_id, filtrar por profesores que enseñan ese curso
    if (course_id) {
      query += ` INNER JOIN teacher_courses tc ON t.id = tc.teacher_id`;
      hasJoin = true;
      hasCoursesJoin = true;
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
      hasJoin = true;
      hasCoursesJoin = true;
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
*/

// Obtener el profesor asignado a un estudiante - MODIFICADA
app.get('/api/teacher/student-teacher/:studentId', async (req, res) => {
  try {
    // Obtener el teacher_id de la relación
    const [rows] = await pool.query(`
      SELECT teacher_id 
      FROM teacher_students 
      WHERE student_id = ?
    `, [req.params.studentId]);
    
    if (rows.length === 0) {
      return res.json({ teacher_id: null });
    }
    
    // Obtener información del profesor
    const [teacherRows] = await pool.query(`
      SELECT t.id as teacher_id, t.user_id, u.name
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `, [rows[0].teacher_id]);
    
    if (teacherRows.length === 0) {
      return res.json({ teacher_id: null });
    }
    
    res.json(teacherRows[0]);
  } catch (error) {
    console.error('❌ Error al obtener profesor del estudiante:', error);
    res.status(500).json({ message: 'Error al obtener profesor del estudiante' });
  }
});

// Actualizar relación estudiante-profesor
app.post('/api/teacher/update-student-teacher', async (req, res) => {
  try {
    const { teacher_id, student_id } = req.body;
    
    // Verificar si ya existe la relación
    const [existingRows] = await pool.query(
      'SELECT * FROM teacher_students WHERE student_id = ?',
      [student_id]
    );
    
    if (existingRows.length > 0) {
      // Actualizar la relación existente
      await pool.query(
        'UPDATE teacher_students SET teacher_id = ? WHERE student_id = ?',
        [teacher_id, student_id]
      );
    } else {
      // Crear la relación
      await pool.query(
        'INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)',
        [teacher_id, student_id]
      );
    }
    
    res.json({ message: 'Relación estudiante-profesor actualizada correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar relación estudiante-profesor:', error);
    res.status(500).json({ message: 'Error al actualizar relación estudiante-profesor' });
  }
});

// Añadir esta ruta a server.js
// Ruta para obtener preguntas del docente por user_id
app.get('/api/teacher/questions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Obtener el teacher_id correspondiente al user_id
    const [teacherRows] = await pool.query(
      'SELECT id, subject FROM teachers WHERE user_id = ?',
      [userId]
    );
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    const teacherId = teacherRows[0].id;
    const subject = teacherRows[0].subject;

    // Obtener las preguntas creadas por este docente (teacher_id) o relacionadas con su materia
    const [rows] = await pool.query(`
      SELECT 
        q.id, q.question_text, q.option1, q.option2, q.option3, q.option4,
        q.correct_answer, q.category, q.image_url, q.questionnaire_id,
        qn.title as questionnaire_title,
        qn.subject,
        qn.category as questionnaire_category,
        qn.grade,
        qn.phase
      FROM questions q
      LEFT JOIN questionnaires qn ON q.questionnaire_id = qn.id
      WHERE qn.created_by = ? OR q.category LIKE ?
      ORDER BY qn.created_at DESC
    `, [teacherId, `${subject}_%`]);

    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener preguntas del docente:', error);
    res.status(500).json({ message: 'Error al obtener preguntas del docente' });
  }
});


// Añadir a server.js o en authRoutes.js
app.get('/api/auth/verify', verificarToken, (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.usuario_id,
      role: req.usuario_role
    }
  });
});

// Servidor corriendo en el puerto 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  
  // Sincronizar subject_categories con questionnaires al iniciar
  try {
    await syncSubjectCategories();
  } catch (error) {
    console.error('⚠️ No se pudo sincronizar subject_categories al iniciar:', error.message);
  }
});

// Ruta para recalcular phase_averages de un estudiante específico
app.post('/api/recalculate-phase-averages/:studentId', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    console.log(`🔧 Solicitud manual de recálculo para estudiante ${studentId}`);
    
    const result = await recalculatePhaseAverages(parseInt(studentId));
    
    if (result.success) {
      console.log(`✅ Recálculo manual exitoso para estudiante ${studentId}`);
      res.json(result);
    } else {
      console.error(`❌ Recálculo manual fallido para estudiante ${studentId}:`, result.error);
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ Error crítico al recalcular phase_averages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ruta para recalcular phase_averages de todos los estudiantes de un profesor
app.post('/api/recalculate-phase-averages/teacher/:teacherId', verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const result = await recalculateAllStudentsPhaseAverages(parseInt(teacherId));
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error al recalcular phase_averages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
