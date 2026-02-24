//import db from '../db.js';
import pool from '../config/db.js';

export const createSubscription = async (teacher_id, plan_type) => {
  const now = new Date();
  let end = new Date();
  if (plan_type === 'monthly') end.setMonth(end.getMonth() + 1);
  if (plan_type === 'annual') end.setFullYear(end.getFullYear() + 1);

  const [result] = await db.query(
    `INSERT INTO subscriptions (teacher_id, plan_type, current_period_start, current_period_end) 
     VALUES (?, ?, ?, ?)`,
    [teacher_id, plan_type, now, end]
  );
  return result.insertId;
};

export const getActiveSubscription = async (teacher_id) => {
  const [rows] = await db.query(
    `SELECT * FROM subscriptions WHERE teacher_id = ? AND status = 'active'`,
    [teacher_id]
  );
  return rows[0];
};

export const updateSubscriptionStatus = async (subscription_id, status) => {
  await db.query(
    `UPDATE subscriptions SET status = ? WHERE id = ?`,
    [status, subscription_id]
  );
};