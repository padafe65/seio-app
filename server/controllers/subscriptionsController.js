import pool from '../config/db.js'; // Asegúrate de que la ruta a tu pool sea correcta

// 1. Notificar pago manual (Nequi) - El docente sube el pantallazo
export const notifyManualPayment = async (req, res) => {
  const { teacher_id, plan_type, amount, transaction_id } = req.body;
  const proof_image = req.file ? `/uploads/payments/${req.file.filename}` : null;

  try {
    // 1. Creamos la suscripción con estado 'past_due' (inactiva aún)
    const [sub] = await pool.query(
      "INSERT INTO subscriptions (teacher_id, plan_type, status, current_period_start, current_period_end) VALUES (?, ?, 'past_due', NOW(), NOW())",
      [teacher_id, plan_type]
    );

    // 2. Registramos el pago como 'pending' con el link de la imagen
    await pool.query(
      "INSERT INTO payments (subscription_id, amount, payment_method, status, transaction_id, proof_image_url) VALUES (?, ?, 'nequi', 'pending', ?, ?)",
      [sub.insertId, amount, transaction_id, proof_image]
    );

    res.json({ success: true, message: "Comprobante enviado. En breve activaremos tu cuenta." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Aprobar pago (Lo ejecuta el Admin desde el panel)
export const approvePayment = async (req, res) => {
  const { payment_id, sub_id, teacher_id, plan_type } = req.body;
  
  try {
    const days = plan_type === 'monthly' ? 30 : 365;

    // 1️⃣ Marcar el pago como exitoso
    await pool.query("UPDATE payments SET status = 'success' WHERE id = ?", [payment_id]);
    
    // 2️⃣ Activar suscripción y establecer fechas reales
    await pool.query(
      `UPDATE subscriptions 
       SET status = 'active', 
           current_period_start = NOW(), 
           current_period_end = DATE_ADD(NOW(), INTERVAL ? DAY) 
       WHERE id = ?`,
      [days, sub_id]
    );

    // 3️⃣ Activar licencia en la tabla de instituciones
    await pool.query(
      `UPDATE teacher_institutions 
       SET license_status = 'active', 
           expiration_date = DATE_ADD(NOW(), INTERVAL ? DAY)
       WHERE teacher_id = ?`,
      [days, teacher_id]
    );

    // 4️⃣ Activar al usuario (estado = 'activo')
    await pool.query(
      `UPDATE users u
       JOIN teachers t ON u.id = t.user_id
       SET u.estado = 'activo'
       WHERE t.id = ?`,
      [teacher_id]
    );

    res.json({ success: true, message: "Licencia activada y usuario habilitado correctamente." });
  } catch (error) {
    console.error("Error al aprobar pago:", error);
    res.status(500).json({ success: false, error: "Error al procesar la activación." });
  }
};

// 3. Obtener todas las suscripciones para el panel Admin (OBLIGATORIO para SubscriptionAdmin.js)
export const getAllSubscriptionsAdmin = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.*, 
        u.name as teacher_name, 
        t.institution,
        p.id as payment_id,
        p.proof_image_url,
        p.status as payment_status
      FROM subscriptions s
      JOIN teachers t ON s.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN payments p ON s.id = p.subscription_id
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// backend/server/controllers/subscriptionsController.js

export const getMySubscription = async (req, res) => {
  try {
    // Asumiendo que el ID del docente viene en el token (req.user.id)
    // o que el usuario logueado es el docente
    const [rows] = await pool.query(
      "SELECT * FROM subscriptions WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = ?) ORDER BY created_at DESC LIMIT 1",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No se encontró suscripción." });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// También asegúrate de que registerSubscription exista si la estás usando
export const registerSubscription = async (req, res) => {
    // Aquí iría tu lógica vieja de registro o puedes dejarla vacía para que no de error
};

export const createCheckoutSession = async (req, res) => {
  res.status(501).json({ message: "Módulo de Stripe no configurado aún. Use pago manual." });
};