// routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Verificar token
router.get('/verify', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email
    }
  });
});

// Iniciar sesión
router.post('/login', async (req, res) => {
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

    // Prepara los datos del usuario para la respuesta
    const userData = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      create_at: user.create_at
    };

    // Si el usuario es docente o super_administrador, obtenemos su teacher_id
    if (user.role === 'docente' || user.role === 'super_administrador') {
      const [teacherRows] = await db.query("SELECT id FROM teachers WHERE user_id = ?", [user.id]);
      if (teacherRows.length > 0) {
        userData.teacher_id = teacherRows[0].id;
      }
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.json({
      message: "Inicio de sesión exitoso",
      token,
      usuario: userData
    });
  } catch (error) {
    console.error('❌ Error en el login:', error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Registrar nuevo usuario
router.post('/register', async (req, res) => {
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

// Restablecer contraseña
router.post('/reestablecer-password', async (req, res) => {
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

export default router;
