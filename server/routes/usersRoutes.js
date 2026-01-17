// routes/usersRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import bcrypt from 'bcrypt';

const router = express.Router();

// Middleware para verificar si el usuario es super_administrador
const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'super_administrador') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Acceso denegado. Se requieren privilegios de super administrador.',
    code: 'SUPER_ADMIN_ACCESS_REQUIRED',
    userRole: req.user?.role
  });
};

// Aplicar verificación de token a todas las rutas
router.use(verifyToken);

// Obtener todos los usuarios (solo super_administrador)
router.get('/users', isSuperAdmin, async (req, res) => {
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
    
    const [users] = await pool.query(
      `SELECT id, name, email, phone, role${institutionField},
              CASE 
                WHEN estado IS NULL THEN 1
                WHEN estado = 'activo' THEN 1
                WHEN estado = 'pendiente' THEN 0
                WHEN estado = 'suspendido' THEN 0
                WHEN estado = 1 THEN 1
                WHEN estado = 0 THEN 0
                ELSE 1
              END as estado,
              created_at 
       FROM users 
       ORDER BY created_at DESC`
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

// Obtener un usuario por ID (solo super_administrador)
router.get('/users/:id', isSuperAdmin, async (req, res) => {
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
    
    const [users] = await pool.query(
      `SELECT id, name, email, phone, role${institutionField},
              CASE 
                WHEN estado IS NULL THEN 1
                WHEN estado = 'activo' THEN 1
                WHEN estado = 'pendiente' THEN 0
                WHEN estado = 'suspendido' THEN 0
                WHEN estado = 1 THEN 1
                WHEN estado = 0 THEN 0
                ELSE 1
              END as estado,
              created_at 
       FROM users 
       WHERE id = ?`,
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

// Crear un nuevo usuario (solo super_administrador)
router.post('/users', isSuperAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, role, institution } = req.body;
    
    // Validar campos requeridos
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: name, email, password, role'
      });
    }
    
    // Validar que el rol sea válido
    const validRoles = ['estudiante', 'docente', 'administrador', 'super_administrador'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Rol inválido. Los roles válidos son: ${validRoles.join(', ')}`
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
    } catch (error) {
      // Ignorar error
    }
    
    // Insertar usuario
    // NOTA: El ENUM de estado en la BD es: ('pendiente','activo','suspendido')
    // Por defecto se crea como 'activo'
    let insertQuery, insertValues, selectFields;
    if (hasInstitution) {
      insertQuery = 'INSERT INTO users (name, email, phone, password, role, estado, institution) VALUES (?, ?, ?, ?, ?, ?, ?)';
      insertValues = [name, email, phone || null, hashedPassword, role, 'activo', institution || null];
      selectFields = 'id, name, email, phone, role, institution';
    } else {
      insertQuery = 'INSERT INTO users (name, email, phone, password, role, estado) VALUES (?, ?, ?, ?, ?, ?)';
      insertValues = [name, email, phone || null, hashedPassword, role, 'activo'];
      selectFields = 'id, name, email, phone, role';
    }
    
    const [result] = await pool.query(insertQuery, insertValues);
    
    // Obtener el usuario creado (sin la contraseña)
    const [newUser] = await pool.query(
      `SELECT ${selectFields},
              CASE 
                WHEN estado IS NULL THEN 1
                WHEN estado = 'activo' THEN 1
                WHEN estado = 'pendiente' THEN 0
                WHEN estado = 'suspendido' THEN 0
                WHEN estado = 1 THEN 1
                WHEN estado = 0 THEN 0
                ELSE 1
              END as estado,
              created_at 
       FROM users 
       WHERE id = ?`,
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
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

// Actualizar un usuario (solo super_administrador)
router.put('/users/:id', isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, estado, password, institution } = req.body;
    
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
    
    // Validar rol si se proporciona
    if (role) {
      const validRoles = ['estudiante', 'docente', 'administrador', 'super_administrador'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Rol inválido. Los roles válidos son: ${validRoles.join(', ')}`
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
      // Convertir número a string según el ENUM de la BD: ('pendiente','activo','suspendido')
      // Si estado es 1, guardar como 'activo', si es 0, guardar como 'pendiente'
      // NOTA: La BD tiene ENUM('pendiente','activo','suspendido'), NO tiene 'inactivo'
      let estadoValue;
      if (typeof estado === 'number') {
        estadoValue = estado === 1 ? 'activo' : 'pendiente';
      } else if (typeof estado === 'string') {
        // Si ya es string, validar que sea uno de los valores válidos del ENUM
        const estadoLower = estado.toLowerCase();
        if (estadoLower === 'activo' || estadoLower === 'pendiente' || estadoLower === 'suspendido') {
          estadoValue = estadoLower;
        } else if (estadoLower === 'inactivo') {
          // 'inactivo' no existe en el ENUM, convertir a 'pendiente'
          estadoValue = 'pendiente';
        } else if (estado === '1' || estado === 1) {
          estadoValue = 'activo';
        } else if (estado === '0' || estado === 0) {
          estadoValue = 'pendiente';
        } else {
          // Por defecto, activo
          estadoValue = 'activo';
        }
      } else {
        estadoValue = estado ? 'activo' : 'pendiente';
      }
      updates.push('estado = ?');
      values.push(estadoValue);
    }
    if (password !== undefined && password !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }
    
    values.push(id);
    
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // Verificar si la columna institution existe para el SELECT
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
    
    // Obtener el usuario actualizado
    const [updatedUser] = await pool.query(
      `SELECT id, name, email, phone, role${institutionField},
              CASE 
                WHEN estado IS NULL THEN 1
                WHEN estado = 'activo' THEN 1
                WHEN estado = 'pendiente' THEN 0
                WHEN estado = 'suspendido' THEN 0
                WHEN estado = 1 THEN 1
                WHEN estado = 0 THEN 0
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

// Eliminar un usuario (solo super_administrador)
router.delete('/users/:id', isSuperAdmin, async (req, res) => {
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
    
    // Eliminar el usuario
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    
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

export default router;

