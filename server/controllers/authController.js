// server/controllers/authController.js
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
    
    // 1. Buscar usuario por email
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [mail]);
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false,
        error: 'Credenciales inválidas' 
      });
    }
    
    const user = users[0];
    
    // 2. Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ 
        success: false,
        error: 'Credenciales inválidas' 
      });
    }
    
    // 3. Obtener información adicional según el rol
    let additionalData = {};
    
    if (user.role === 'docente') {
      // Si es docente, obtener o crear la información del docente
      try {
        const [teachers] = await pool.query('SELECT * FROM teachers WHERE user_id = ?', [user.id]);
        
        if (teachers.length > 0) {
          // Si ya existe el registro del docente
          const teacher = teachers[0];
          additionalData = {
            teacher_id: teacher.id,
            user_id: user.id,
            ...(teacher.institution_id && { institution_id: teacher.institution_id }),
            ...(teacher.specialty && { specialty: teacher.specialty })
          };
          console.log('✅ Docente encontrado en la base de datos:', additionalData);
        } else {
          // Si no existe, crear un nuevo registro de docente
          console.log('⚠️ No se encontró registro de docente, creando uno nuevo...');
          const [result] = await pool.query(
            'INSERT INTO teachers (user_id, created_at, updated_at) VALUES (?, NOW(), NOW())',
            [user.id]
          );
          
          if (result.insertId) {
            additionalData = {
              teacher_id: result.insertId,
              user_id: user.id
            };
            console.log('✅ Nuevo registro de docente creado con ID:', result.insertId);
          } else {
            throw new Error('No se pudo crear el registro del docente');
          }
        }
      } catch (error) {
        console.error('❌ Error al obtener/crear el registro del docente:', error);
        console.error('❌ Error al obtener/crear el registro del profesor:', error);
        return res.status(500).json({
          success: false,
          error: 'Error al procesar el registro del docente',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    } else if (user.role === 'estudiante') {
      // Si es estudiante, obtener el ID de la tabla students
      const [students] = await pool.query('SELECT * FROM students WHERE user_id = ?', [user.id]);
      if (students.length > 0) {
        additionalData = {
          student_id: students[0].id,  // ID de la tabla students
          user_id: user.id,           // ID de la tabla users
          ...students[0]              // Incluir todos los datos del estudiante
        };
      }
    }
    
    // 4. Crear token JWT con la información relevante
    const tokenPayload = {
      id: user.id,
      role: user.role,
      ...additionalData
    };
    
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
    
    // 4. Asegurarse de que los docentes tengan un teacher_id
    if (user.role === 'docente' && !additionalData.teacher_id) {
      console.warn('⚠️ Usuario docente sin teacher_id, creando uno...');
      try {
        const [result] = await pool.query(
          'INSERT INTO teachers (user_id, created_at, updated_at) VALUES (?, NOW(), NOW())',
          [user.id]
        );
        if (result.insertId) {
          additionalData.teacher_id = result.insertId;
          console.log('✅ Nuevo registro de docente creado con ID:', result.insertId);
        }
      } catch (error) {
        console.error('❌ Error al crear registro de docente:', error);
      }
    }

    // 5. Preparar la respuesta
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      estado: user.estado,
      ...additionalData
    };
    
    console.log('📤 Datos del usuario a enviar en la respuesta:', userData);
    
    // Asegurarse de que el teacher_id esté en el nivel superior
    if (additionalData.teacher_id) {
      userData.teacher_id = additionalData.teacher_id;
    }
    
    // Para depuración
    console.log('🔍 Datos del usuario que se envían en la respuesta:', {
      ...userData,
      hasTeacherId: !!userData.teacher_id
    });
    
    // Enviar respuesta con ambos formatos para compatibilidad
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: userData,  // Nuevo formato
      usuario: userData  // Mantener para compatibilidad
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error en el servidor al iniciar sesión',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

