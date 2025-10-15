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
import { verifyToken } from './middleware/authMiddleware.js';
import { recalculatePhaseAverages, recalculateAllStudentsPhaseAverages } from './utils/recalculatePhaseAverages.js';
import teacherCoursesRoutes from './routes/teacherCoursesRoutes.js';
import teachers from './routes/teachers.js';
import indicatorsRoutes from './routes/indicatorRoutes.js';
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
// Configuración de rutas
app.use('/api/students', studentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/questionnaires', questionnaireRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/evaluation-results', evaluationResultsRoutes);
app.use('/api/improvement-plans', improvementPlansRoutes);
app.use('/api/phase-evaluation', phaseEvaluationRoutes);
app.use('/api/teachers', teachers);
app.use('/api/teacher-courses', teacherCoursesRoutes);
app.use('/api/questionnaire-indicators', questionnaireIndicatorsRoutes);
app.use('/api/indicator-evaluation', indicatorEvaluationRoutes);
app.use('/api/indicators', indicatorsRoutes);

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

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (rows.length === 0) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.json({
      message: "Inicio de sesión exitoso",
      token,
      usuario: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        password: user.password,
        role: user.role,
        create_at: user.create_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// 🔹 Nueva ruta para registrar usuarios
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

// Ruta para obtener todos los cursos
app.get('/api/courses', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name FROM courses ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener cursos:', error);
    res.status(500).json({ message: 'Error al obtener cursos' });
  }
});

// Ruta para completar datos de estudiante
// En server.js, modificar la ruta /api/students:
app.post('/api/students', async (req, res) => {
  try {
    const { user_id, name, contact_phone, contact_email, age, grade, course_id, teacher_id } = req.body;
    
    console.log("Datos recibidos para estudiante:", req.body);
    
    // Si no hay user_id pero hay name, crear primero el usuario
    let userId = user_id;
    
    if (!userId && name) {
      // Crear un nuevo usuario
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const [userResult] = await db.query(
        'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
        [name, contact_email, contact_phone, hashedPassword, 'estudiante']
      );
      
      userId = userResult.insertId;
      console.log("Usuario creado con ID:", userId);
    }
    
    // Verificar que user_id no sea nulo
    if (!userId) {
      return res.status(400).json({ message: 'El campo user_id es obligatorio' });
    }
    
    // Guardar los datos en la tabla 'students'
    const [result] = await db.query(
      'INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, contact_phone, contact_email, age, grade, course_id]
    );
    
    const studentId = result.insertId;
    
    // Si se proporcionó un teacher_id, crear la relación en teacher_students
    if (teacher_id) {
      await db.query(
        'INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)',
        [teacher_id, studentId]
      );
    }
    
    res.status(201).json({ message: 'Estudiante registrado correctamente', studentId: studentId });
  } catch (error) {
    console.error('❌ Error registrando estudiante:', error);
    res.status(500).json({ message: 'Error al registrar estudiante', error: error.message });
  }
});



// Ruta para obtener todos los estudiantes
app.get('/api/students', async (req, res) => {
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
    
    const [rows] = await db.query(`
      SELECT 
        s.id, s.user_id, s.contact_phone, s.contact_email, s.age, s.grade, s.course_id,
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
    
    // Actualizar datos en la tabla students
    await db.query(
      'UPDATE students SET contact_phone = ?, contact_email = ?, age = ?, grade = ?, course_id = ? WHERE id = ?',
      [contact_phone, contact_email, age, grade, course_id, id]
    );
    
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

// Ruta para completar datos de teacher
app.post('/api/teachers', async (req, res) => {
  try {
    const { user_id, subject, institution } = req.body;

    console.log("Datos recibidos para docente:", req.body);

    // Aquí deberías guardar los datos en la tabla 'students'
    const result = await db.query(
      'INSERT INTO teachers (user_id, subject, institution) VALUES (?, ?, ?)',
      [user_id, subject, institution]
    );

    res.status(201).json({ message: 'Donte registrado correctamente', teacherId: result.insertId });

  } catch (error) {
    console.error('❌ Error registrando docente:', error);
    res.status(500).json({ message: 'Error al registrar dodente' });
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
    const [rows] = await db.query(
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
    const [rows] = await db.query(
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
    
    const [rows] = await db.query(
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

// Añadir a server.js o crear en routes/teacherRoutes.js
app.get('/api/teachers/list', async (req, res) => {
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
    res.status(500).json({ message: 'Error al obtener lista de profesores' });
  }
});

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
