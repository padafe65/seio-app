// backend-rifa/controllers/authController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const register = async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [name, phone, email, hashedPassword, role]
    );

    // MySQL devuelve el id insertado en result.insertId
    const userId = result.insertId;

    res.status(201).json({ message: 'Usuario registrado', userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el registro' });
  }
};

export const login = async (req, res) => {
  try {
    const { mail, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE mail = ?', [mail]);
    if (users.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });
    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, role: user.role });
  } catch (error) {
    res.status(500).json({ error: 'Error en login' });
  }
};

