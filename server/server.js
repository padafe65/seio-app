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
import questionRoutes from './routes/questionRoutes.js';
import questionnaireRoutes from './routes/questionnaireRoutes.js';
import quizRoutes from './routes/quiz.js';
import pool from './config/db.js';

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
app.use(cors());
app.use(express.json()); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/', questionRoutes);
app.use('/api/questionnaires', questionnaireRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/intentos-por-fase', quizRoutes);

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
    const { user_id, contact_phone, contact_email, age, grade, course_id } = req.body;

    console.log("Datos recibidos para estudiante:", req.body);

    // Verificar que user_id no sea nulo
    if (!user_id) {
      return res.status(400).json({ message: 'El campo user_id es obligatorio' });
    }

    // Verificar que no exista ya un estudiante con ese user_id
    const [existingStudent] = await db.query('SELECT id FROM students WHERE user_id = ?', [user_id]);
    if (existingStudent.length > 0) {
      return res.status(400).json({ message: 'Ya existe un estudiante asociado a este usuario' });
    }

    // Guardar los datos en la tabla 'students'
    const [result] = await db.query(
      'INSERT INTO students (user_id, contact_phone, contact_email, age, grade, course_id) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, contact_phone, contact_email, age, grade, course_id]
    );

    res.status(201).json({ message: 'Estudiante registrado correctamente', studentId: result.insertId });

  } catch (error) {
    console.error('❌ Error registrando estudiante:', error);
    res.status(500).json({ message: 'Error al registrar estudiante' });
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
    const { contact_phone, contact_email, age, grade, course_id, name, email, phone } = req.body;

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
app.get('/api/categories/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    
    const [rows] = await db.query(
      'SELECT category FROM subject_categories WHERE subject = ?',
      [subject]
    );
    
    res.json(rows.map(row => row.category));
  } catch (error) {
    console.error('❌ Error al obtener categorías:', error);
    res.status(500).json({ message: 'Error al obtener categorías' });
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

// Ruta para obtener categorías por materia
app.get('/api/subject-categories/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    
    // Si la materia es "Matemàticas", buscar como "Matematicas" (sin tilde)
    const searchSubject = subject === 'Matemàticas' ? 'Matematicas' : subject;
    
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


// Servidor corriendo en el puerto 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
