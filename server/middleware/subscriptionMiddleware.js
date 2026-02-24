import pool from '../config/db.js';

export const checkSubscription = async (req, res, next) => {
  try {

    // Admin y super admin no se bloquean
    if (
      req.user.role === 'administrador' ||
      req.user.role === 'super_administrador'
    ) {
      return next();
    }

    const userId = req.user.id;

    const [rows] = await pool.query(`
      SELECT s.status, s.current_period_end
      FROM subscriptions s
      JOIN teachers t ON s.teacher_id = t.id
      WHERE t.user_id = ?
      ORDER BY s.id DESC
      LIMIT 1
    `, [userId]);

    if (!rows.length) {
      return res.status(403).json({
        code: 'NO_SUBSCRIPTION'
      });
    }

    const sub = rows[0];

    if (
      sub.status !== 'active' ||
      new Date(sub.current_period_end) < new Date()
    ) {
      return res.status(403).json({
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    next();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error validando suscripción' });
  }
};