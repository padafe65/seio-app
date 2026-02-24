import cron from 'node-cron';
import db from './db.js';

cron.schedule('0 0 * * *', async () => {
  const [expiredSubs] = await db.query(`
    SELECT * FROM subscriptions 
    WHERE current_period_end < NOW() AND status = 'active'
  `);

  for (const sub of expiredSubs) {
    await db.query(`UPDATE subscriptions SET status = 'past_due' WHERE id = ?`, [sub.id]);
    await db.query(`UPDATE teacher_institutions SET license_status = 'expired' WHERE teacher_id = ?`, [sub.teacher_id]);
    await db.query(`
      UPDATE users u
      JOIN teachers t ON u.id = t.user_id
      SET u.estado = 'suspendido'
      WHERE t.id = ?
    `, [sub.teacher_id]);
  }

  console.log('Cron job: Licencias vencidas revisadas');
});