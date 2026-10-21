import pool from '../config/db.js';

/**
 * Ensures a teacher's initial 30-day subscription and its matching institutional
 * license exist. Existing subscription history is preserved; an active paid or
 * trial subscription only repairs a missing/stale license.
 */
export const ensureTeacherTrialSubscription = async (teacherId, planType = 'monthly') => {
  const normalizedPlan = planType === 'annual' ? 'annual' : 'monthly';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [teachers] = await connection.query(
      'SELECT id, institution FROM teachers WHERE id = ? FOR UPDATE', [teacherId]
    );
    if (!teachers.length) throw new Error(`No existe el perfil docente ${teacherId}`);

    let [subscriptions] = await connection.query(
      `SELECT id, status, current_period_start, current_period_end,
              (status = 'active' AND current_period_end >= CURRENT_DATE) AS is_current
       FROM subscriptions WHERE teacher_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`, [teacherId]
    );
    let subscriptionCreated = false;
    if (!subscriptions.length) {
      const [inserted] = await connection.query(
        `INSERT INTO subscriptions
          (teacher_id, plan_type, status, current_period_start, current_period_end)
         VALUES (?, ?, 'active', CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY))`,
        [teacherId, normalizedPlan]
      );
      subscriptionCreated = true;
      [subscriptions] = await connection.query(
        `SELECT id, status, current_period_start, current_period_end,
                (status = 'active' AND current_period_end >= CURRENT_DATE) AS is_current
         FROM subscriptions WHERE id = ?`,
        [inserted.insertId]
      );
    }

    const subscription = subscriptions[0];
    const institution = teachers[0].institution || 'Sin asignar';
    const [licenseRows] = await connection.query(
      `SELECT id FROM teacher_institutions
       WHERE teacher_id = ? AND institution = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [teacherId, institution]
    );
    const subscriptionIsCurrent = Number(subscription.is_current) === 1;
    let licenseCreated = false;

    if (subscriptionIsCurrent) {
      if (licenseRows.length) {
        await connection.query(
          `UPDATE teacher_institutions
           SET license_status = 'active',
               purchased_date = (SELECT current_period_start FROM subscriptions WHERE id = ?),
               expiration_date = (SELECT current_period_end FROM subscriptions WHERE id = ?),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [subscription.id, subscription.id, licenseRows[0].id]
        );
      } else {
        await connection.query(
          `INSERT INTO teacher_institutions
            (teacher_id, institution, license_status, purchased_date, expiration_date)
           SELECT ?, ?, 'active', current_period_start, current_period_end
           FROM subscriptions WHERE id = ?`,
          [teacherId, institution, subscription.id]
        );
        licenseCreated = true;
      }
      await connection.query(
        `UPDATE teachers SET
          total_licenses = (SELECT COUNT(*) FROM teacher_institutions WHERE teacher_id = ?),
          active_licenses = (SELECT COUNT(*) FROM teacher_institutions WHERE teacher_id = ? AND license_status = 'active')
         WHERE id = ?`,
        [teacherId, teacherId, teacherId]
      );
    }

    await connection.commit();
    return {
      created: subscriptionCreated,
      licenseCreated,
      accessReady: subscriptionIsCurrent,
      planType: normalizedPlan
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
