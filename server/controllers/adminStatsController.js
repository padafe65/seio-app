const db = require('../config/db');

const getAdminStats = async (req, res) => {
  try {
    // Obtener estadísticas generales
    const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ totalTeachers }]] = await db.query('SELECT COUNT(*) as totalTeachers FROM teachers');
    const [[{ totalStudents }]] = await db.query('SELECT COUNT(*) as totalStudents FROM students');
    const [[{ totalQuestionnaires }]] = await db.query('SELECT COUNT(*) as totalQuestionnaires FROM questionnaires');
    const [[{ totalQuestions }]] = await db.query('SELECT COUNT(*) as totalQuestions FROM questions');

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(totalUsers),
        totalTeachers: parseInt(totalTeachers),
        totalStudents: parseInt(totalStudents),
        totalQuestionnaires: parseInt(totalQuestionnaires),
        totalQuestions: parseInt(totalQuestions)
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

module.exports = {
  getAdminStats
};
