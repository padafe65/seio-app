const pool = require('../config/db');

// Obtener todos los estudiantes
const getStudents = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*, 
        u.email as user_email,
        u.phone as user_phone,
        u.role,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      ORDER BY s.name
    `;

    const [students] = await pool.query(query);
    
    res.json(students);
  } catch (error) {
    console.error('Error al obtener estudiantes:', error);
    res.status(500).json({ 
      message: 'Error del servidor al obtener estudiantes',
      error: error.message
    });
  }
};

// Obtener un estudiante por ID
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        s.*, 
        u.email as user_email,
        u.phone as user_phone,
        u.role,
        c.name as course_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.id = ?
    `;

    const [students] = await pool.query(query, [id]);
    
    if (students.length === 0) {
      return res.status(404).json({ 
        message: 'Estudiante no encontrado',
        error: 'NOT_FOUND'
      });
    }

    res.json(students[0]);
  } catch (error) {
    console.error('Error al obtener estudiante:', error);
    res.status(500).json({ 
      message: 'Error del servidor al obtener estudiante',
      error: error.message
    });
  }
};

// Exportar las funciones
module.exports = {
    getStudents,
    getStudentById
};
