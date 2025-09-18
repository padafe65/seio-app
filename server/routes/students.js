    const [rows] = await pool.query(`
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
