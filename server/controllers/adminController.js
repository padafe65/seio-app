import db from '../config/db.js';

// Obtener todos los estudiantes (para super administrador)
export const getStudents = async (req, res) => {
  try {
    const [students] = await db.query(`
      SELECT s.*, u.name, u.email, u.phone, u.estado, u.role, 
             r.name as role_name, r.description as role_description
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN roles r ON u.role = r.name
    `);
    
    res.json({
      success: true,
      data: students
    });
  } catch (error) {
    console.error('Error al obtener estudiantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estudiantes',
      error: error.message
    });
  }
};

// Obtener todos los docentes (para super administrador)
export const getTeachers = async (req, res) => {
  try {
    const [teachers] = await db.query(`
      SELECT t.*, u.name, u.email, u.phone, u.estado, u.role, 
             r.name as role_name, r.description as role_description
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN roles r ON u.role = r.name
    `);
    
    res.json({
      success: true,
      data: teachers
    });
  } catch (error) {
    console.error('Error al obtener docentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener docentes',
      error: error.message
    });
  }
};

export const getAdminStats = async (req, res) => {
  try {
    const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ totalTeachers }]] = await db.query('SELECT COUNT(*) as totalTeachers FROM teachers');
    const [[{ totalStudents }]] = await db.query('SELECT COUNT(*) as totalStudents FROM students');

    res.json({
      totalUsers,
      totalTeachers,
      totalStudents,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};


