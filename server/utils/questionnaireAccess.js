import pool from '../config/db.js';

// Ordinary questionnaires keep their existing visibility rules. Imported,
// licensed products require an explicit grant (or ownership).
export const hasQuestionnaireAccess = async (questionnaireId, user) => {
  const [restricted] = await pool.query(
    'SELECT owner_user_id FROM restricted_questionnaires WHERE questionnaire_id = ?',
    [questionnaireId]
  );
  if (!restricted.length) return true;
  if (Number(restricted[0].owner_user_id) === Number(user?.id)) return true;

  const [grants] = await pool.query(
    `SELECT id FROM questionnaire_access_grants
     WHERE questionnaire_id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
    [questionnaireId, user?.id]
  );
  return grants.length > 0;
};

// Los productos privados solo los administra la cuenta propietaria. Las
// licencias conceden acceso para consultar y responder, nunca para editarlos.
export const canManageQuestionnaire = async (questionnaireId, user) => {
  const [restricted] = await pool.query(
    'SELECT owner_user_id FROM restricted_questionnaires WHERE questionnaire_id = ?',
    [questionnaireId]
  );
  if (!restricted.length) return true;
  return user?.role === 'super_administrador'
    && Number(restricted[0].owner_user_id) === Number(user.id);
};

export const requireQuestionnaireAccess = async (req, res, next) => {
  try {
    let questionnaireId = req.params.id || req.params.questionnaireId || req.body?.questionnaire_id || req.body?.questionnaireId;
    if (!questionnaireId && req.body?.session_id) {
      const [sessions] = await pool.query('SELECT questionnaire_id FROM quiz_sessions WHERE id = ?', [req.body.session_id]);
      questionnaireId = sessions[0]?.questionnaire_id;
    }
    if (!questionnaireId || await hasQuestionnaireAccess(questionnaireId, req.user)) return next();
    return res.status(403).json({
      success: false,
      code: 'QUESTIONNAIRE_ACCESS_REQUIRED',
      message: 'Este material es privado. Solicita autorización al superadministrador.'
    });
  } catch (error) {
    console.error('Error verificando acceso a cuestionario:', error);
    return res.status(500).json({ success: false, message: 'No se pudo verificar el acceso al cuestionario.' });
  }
};
