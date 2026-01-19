import pool from '../config/db.js';

/**
 * Enviar un mensaje
 * POST /api/messages
 */
export const sendMessage = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { receiver_id, subject, message, message_type, related_entity_type, related_entity_id } = req.body;
    const sender_id = req.user.id;
    
    // Validaciones
    if (!receiver_id || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: receiver_id, subject, message'
      });
    }
    
    // Validar que no se envíe a sí mismo
    if (parseInt(sender_id) === parseInt(receiver_id)) {
      return res.status(400).json({
        success: false,
        message: 'No puedes enviar un mensaje a ti mismo'
      });
    }
    
    // Verificar que el receptor existe
    const [receiverRows] = await connection.query(
      'SELECT id, role FROM users WHERE id = ?',
      [receiver_id]
    );
    
    if (receiverRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario receptor no encontrado'
      });
    }
    
    const receiver = receiverRows[0];
    
    // Validar permisos según el rol del remitente
    const senderRole = req.user.role;
    
    // Estudiantes solo pueden enviar a sus docentes asignados o administradores
    if (senderRole === 'estudiante') {
      if (receiver.role === 'docente') {
        // Verificar que el docente está asignado al estudiante
        const [studentRows] = await connection.query(
          'SELECT id FROM students WHERE user_id = ?',
          [sender_id]
        );
        
        if (studentRows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Debes completar tu registro de estudiante primero'
          });
        }
        
        const studentId = studentRows[0].id;
        
        const [teacherStudentRows] = await connection.query(
          `SELECT ts.id 
           FROM teacher_students ts
           JOIN teachers t ON ts.teacher_id = t.id
           WHERE ts.student_id = ? AND t.user_id = ?`,
          [studentId, receiver_id]
        );
        
        if (teacherStudentRows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Solo puedes enviar mensajes a tus docentes asignados'
          });
        }
      } else if (receiver.role !== 'administrador' && receiver.role !== 'super_administrador') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para enviar mensajes a este usuario'
        });
      }
    }
    
    // Docentes solo pueden enviar a sus estudiantes asignados, administradores o super_administradores
    if (senderRole === 'docente') {
      if (receiver.role === 'estudiante') {
        // Verificar que el estudiante está asignado al docente
        const [teacherRows] = await connection.query(
          'SELECT id FROM teachers WHERE user_id = ?',
          [sender_id]
        );
        
        if (teacherRows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Debes completar tu registro de docente primero'
          });
        }
        
        const teacherId = teacherRows[0].id;
        
        const [studentRows] = await connection.query(
          'SELECT id FROM students WHERE user_id = ?',
          [receiver_id]
        );
        
        if (studentRows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'El estudiante no tiene registro completo'
          });
        }
        
        const studentId = studentRows[0].id;
        
        const [teacherStudentRows] = await connection.query(
          'SELECT id FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
          [teacherId, studentId]
        );
        
        if (teacherStudentRows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Solo puedes enviar mensajes a tus estudiantes asignados'
          });
        }
      } else if (receiver.role !== 'administrador' && receiver.role !== 'super_administrador') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para enviar mensajes a este usuario'
        });
      }
    }
    
    // Administradores y super_administradores pueden enviar a cualquiera
    // (no se requiere validación adicional)
    
    // Insertar el mensaje
    const [result] = await connection.query(
      `INSERT INTO messages 
       (sender_id, receiver_id, subject, message, message_type, related_entity_type, related_entity_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sender_id,
        receiver_id,
        subject,
        message,
        message_type || 'general',
        related_entity_type || null,
        related_entity_id || null
      ]
    );
    
    // Obtener el mensaje creado con información del remitente y receptor
    const [messageRows] = await connection.query(
      `SELECT 
        m.*,
        sender.name as sender_name,
        sender.email as sender_email,
        sender.role as sender_role,
        receiver.name as receiver_name,
        receiver.email as receiver_email,
        receiver.role as receiver_role
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.id = ?`,
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Mensaje enviado correctamente',
      data: messageRows[0]
    });
    
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtener bandeja de entrada
 * GET /api/messages/inbox
 */
export const getInbox = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const userId = req.user.id;
    const { read_status, message_type, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        m.*,
        sender.name as sender_name,
        sender.email as sender_email,
        sender.role as sender_role,
        sender.phone as sender_phone
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      WHERE m.receiver_id = ?
        AND (m.deleted_at_receiver IS NULL)
    `;
    
    const params = [userId];
    
    if (read_status !== undefined) {
      query += ` AND m.read_status = ?`;
      params.push(read_status === 'true');
    }
    
    if (message_type) {
      query += ` AND m.message_type = ?`;
      params.push(message_type);
    }
    
    query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));
    
    const [messages] = await connection.query(query, params);
    
    // Obtener conteo total
    let countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      WHERE m.receiver_id = ?
        AND (m.deleted_at_receiver IS NULL)
    `;
    
    const countParams = [userId];
    
    if (read_status !== undefined) {
      countQuery += ` AND m.read_status = ?`;
      countParams.push(read_status === 'true');
    }
    
    if (message_type) {
      countQuery += ` AND m.message_type = ?`;
      countParams.push(message_type);
    }
    
    const [countRows] = await connection.query(countQuery, countParams);
    const total = countRows[0].total;
    
    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
    
  } catch (error) {
    console.error('Error al obtener bandeja de entrada:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mensajes',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtener mensajes enviados
 * GET /api/messages/sent
 */
export const getSentMessages = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const [messages] = await connection.query(
      `SELECT 
        m.*,
        receiver.name as receiver_name,
        receiver.email as receiver_email,
        receiver.role as receiver_role,
        receiver.phone as receiver_phone
       FROM messages m
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.sender_id = ?
         AND (m.deleted_at IS NULL)
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), parseInt(offset)]
    );
    
    const [countRows] = await connection.query(
      `SELECT COUNT(*) as total
       FROM messages m
       WHERE m.sender_id = ?
         AND (m.deleted_at IS NULL)`,
      [userId]
    );
    
    res.json({
      success: true,
      data: messages,
      pagination: {
        total: countRows[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < countRows[0].total
      }
    });
    
  } catch (error) {
    console.error('Error al obtener mensajes enviados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mensajes enviados',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtener un mensaje específico
 * GET /api/messages/:id
 */
export const getMessage = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const [messageRows] = await connection.query(
      `SELECT 
        m.*,
        sender.name as sender_name,
        sender.email as sender_email,
        sender.role as sender_role,
        sender.phone as sender_phone,
        receiver.name as receiver_name,
        receiver.email as receiver_email,
        receiver.role as receiver_role,
        receiver.phone as receiver_phone
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.id = ?
         AND (m.sender_id = ? OR m.receiver_id = ?)
         AND (m.deleted_at IS NULL OR m.sender_id != ?)
         AND (m.deleted_at_receiver IS NULL OR m.receiver_id != ?)`,
      [id, userId, userId, userId, userId]
    );
    
    if (messageRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado'
      });
    }
    
    const message = messageRows[0];
    
    // Si el usuario es el receptor y el mensaje no está leído, marcarlo como leído
    if (parseInt(message.receiver_id) === userId && !message.read_status) {
      await connection.query(
        'UPDATE messages SET read_status = TRUE WHERE id = ?',
        [id]
      );
      message.read_status = true;
    }
    
    res.json({
      success: true,
      data: message
    });
    
  } catch (error) {
    console.error('Error al obtener mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el mensaje',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Marcar mensaje como leído
 * PUT /api/messages/:id/read
 */
export const markAsRead = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Verificar que el usuario es el receptor
    const [messageRows] = await connection.query(
      'SELECT receiver_id FROM messages WHERE id = ?',
      [id]
    );
    
    if (messageRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado'
      });
    }
    
    if (parseInt(messageRows[0].receiver_id) !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para marcar este mensaje como leído'
      });
    }
    
    await connection.query(
      'UPDATE messages SET read_status = TRUE WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Mensaje marcado como leído'
    });
    
  } catch (error) {
    console.error('Error al marcar mensaje como leído:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar el mensaje como leído',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Eliminar mensaje (soft delete)
 * DELETE /api/messages/:id
 */
export const deleteMessage = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Verificar que el usuario es el remitente o receptor
    const [messageRows] = await connection.query(
      'SELECT sender_id, receiver_id FROM messages WHERE id = ?',
      [id]
    );
    
    if (messageRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado'
      });
    }
    
    const message = messageRows[0];
    const isSender = parseInt(message.sender_id) === userId;
    const isReceiver = parseInt(message.receiver_id) === userId;
    
    if (!isSender && !isReceiver) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este mensaje'
      });
    }
    
    // Soft delete según el rol del usuario
    if (isSender) {
      await connection.query(
        'UPDATE messages SET deleted_at = NOW() WHERE id = ?',
        [id]
      );
    }
    
    if (isReceiver) {
      await connection.query(
        'UPDATE messages SET deleted_at_receiver = NOW() WHERE id = ?',
        [id]
      );
    }
    
    res.json({
      success: true,
      message: 'Mensaje eliminado correctamente'
    });
    
  } catch (error) {
    console.error('Error al eliminar mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el mensaje',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtener contador de mensajes no leídos
 * GET /api/messages/unread-count
 */
export const getUnreadCount = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const userId = req.user.id;
    
    const [countRows] = await connection.query(
      `SELECT COUNT(*) as count
       FROM messages
       WHERE receiver_id = ?
         AND read_status = FALSE
         AND (deleted_at_receiver IS NULL)`,
      [userId]
    );
    
    res.json({
      success: true,
      count: countRows[0].count
    });
    
  } catch (error) {
    console.error('Error al obtener contador de no leídos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener contador de mensajes no leídos',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtener destinatarios disponibles según el rol del remitente
 * GET /api/messages/recipients
 */
export const getAvailableRecipients = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let recipients = [];
    
    if (userRole === 'estudiante') {
      // Estudiantes pueden enviar a sus docentes asignados, administradores y super_administradores
      const [studentRows] = await connection.query(
        'SELECT id FROM students WHERE user_id = ?',
        [userId]
      );
      
      if (studentRows.length > 0) {
        const studentId = studentRows[0].id;
        
        // Docentes asignados
        const [teachers] = await connection.query(
          `SELECT DISTINCT
            u.id,
            u.name,
            u.email,
            u.role,
            t.subject
           FROM teacher_students ts
           JOIN teachers t ON ts.teacher_id = t.id
           JOIN users u ON t.user_id = u.id
           WHERE ts.student_id = ?
           ORDER BY u.name`,
          [studentId]
        );
        
        recipients.push(...teachers);
      }
      
      // Administradores y super_administradores
      const [admins] = await connection.query(
        `SELECT id, name, email, role, NULL as subject
         FROM users
         WHERE role IN ('administrador', 'super_administrador')
         ORDER BY role, name`,
        []
      );
      
      recipients.push(...admins);
      
    } else if (userRole === 'docente') {
      // Docentes pueden enviar a sus estudiantes asignados, administradores y super_administradores
      const [teacherRows] = await connection.query(
        'SELECT id FROM teachers WHERE user_id = ?',
        [userId]
      );
      
      if (teacherRows.length > 0) {
        const teacherId = teacherRows[0].id;
        
        // Estudiantes asignados
        const [students] = await connection.query(
          `SELECT DISTINCT
            u.id,
            u.name,
            u.email,
            u.role,
            s.grade,
            c.name as course_name
           FROM teacher_students ts
           JOIN students s ON ts.student_id = s.id
           JOIN users u ON s.user_id = u.id
           LEFT JOIN courses c ON s.course_id = c.id
           WHERE ts.teacher_id = ?
           ORDER BY s.grade, u.name`,
          [teacherId]
        );
        
        recipients.push(...students);
      }
      
      // Administradores y super_administradores
      const [admins] = await connection.query(
        `SELECT id, name, email, role, NULL as grade, NULL as course_name
         FROM users
         WHERE role IN ('administrador', 'super_administrador')
         ORDER BY role, name`,
        []
      );
      
      recipients.push(...admins);
      
    } else if (userRole === 'administrador' || userRole === 'super_administrador') {
      // Administradores y super_administradores pueden enviar a cualquiera
      const [allUsers] = await connection.query(
        `SELECT 
          u.id,
          u.name,
          u.email,
          u.role,
          CASE 
            WHEN u.role = 'docente' THEN t.subject
            WHEN u.role = 'estudiante' THEN s.grade
            ELSE NULL
          END as additional_info
         FROM users u
         LEFT JOIN teachers t ON u.id = t.user_id
         LEFT JOIN students s ON u.id = s.user_id
         WHERE u.id != ?
           AND u.role IN ('estudiante', 'docente', 'administrador', 'super_administrador')
         ORDER BY u.role, u.name`,
        [userId]
      );
      
      recipients = allUsers;
    }
    
    res.json({
      success: true,
      data: recipients
    });
    
  } catch (error) {
    console.error('Error al obtener destinatarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener destinatarios disponibles',
      error: error.message
    });
  } finally {
    connection.release();
  }
};
