//import db from '../db.js';
import pool from '../config/db.js';

export const createPayment = async (subscription_id, amount, payment_method, status, transaction_id = null) => {
  const [result] = await db.query(
    `INSERT INTO payments (subscription_id, amount, payment_method, status, transaction_id) VALUES (?, ?, ?, ?, ?)`,
    [subscription_id, amount, payment_method, status, transaction_id]
  );
  return result.insertId;
};

export const getPaymentsBySubscription = async (subscription_id) => {
  const [rows] = await db.query(
    `SELECT * FROM payments WHERE subscription_id = ? ORDER BY payment_date DESC`,
    [subscription_id]
  );
  return rows;
};