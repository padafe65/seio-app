const pool = require('../config/db');
const { verificarToken, esDocente, esSuperAdmin } = require('../middleware/authMiddleware');

// Obtener cuestionarios por profesor
const getQuestionnairesByTeacher = async (req, res) => {
    try {
        const { teacherId } = req.params;
        
        // Validar que el ID del profesor sea válido
        if (!teacherId || teacherId === 'undefined' || teacherId === 'null' || teacherId === '-1') {
            return res.status(400).json({ 
                message: 'ID de docente no válido',
                error: 'BAD_REQUEST'
            });
        }

        // Si el usuario es docente, solo puede ver sus propios cuestionarios
        if (req.user.role === 'docente' && parseInt(teacherId) !== req.user.teacherId) {
            return res.status(403).json({ 
                message: 'No tienes permiso para ver estos cuestionarios',
                error: 'FORBIDDEN',
                details: 'Solo puedes ver tus propios cuestionarios'
            });
        }

        // Consulta SQL para obtener los cuestionarios con información del profesor
        const query = `
            SELECT q.*, u.name as teacher_name, u.email as teacher_email
            FROM questionnaires q
            JOIN teachers t ON q.created_by = t.id
            JOIN users u ON t.user_id = u.id
            WHERE q.created_by = ?
            ORDER BY q.created_at DESC
        `;
        
        // Verificar permisos antes de ejecutar la consulta
        if (req.user.role !== 'super_administrador' && parseInt(teacherId) !== req.user.teacher_id) {
            return res.status(403).json({ 
                message: 'No tienes permiso para ver estos cuestionarios',
                error: 'FORBIDDEN',
                details: 'Solo puedes ver tus propios cuestionarios'
            });
        }
        
        const [questionnaires] = await pool.query(query, [teacherId]);
        
        if (!questionnaires || questionnaires.length === 0) {
            return res.status(404).json({ 
                message: 'No se encontraron cuestionarios',
                data: []
            });
        }

        res.status(200).json({
            message: 'Cuestionarios obtenidos correctamente',
            data: questionnaires
        });
    } catch (error) {
        console.error('Error al obtener cuestionarios:', error);
        res.status(500).json({ 
            message: 'Error del servidor al obtener cuestionarios',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Exportar las funciones
module.exports = {
    getQuestionnairesByTeacher
};
