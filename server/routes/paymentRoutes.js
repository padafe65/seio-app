import express from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { logRequestAudit } from '../utils/auditLogger.js';

const router = express.Router();

// Middleware para restringir a Administradores y Super Administradores
const isAdminRole = (req, res, next) => {
    if (req.user && (req.user.role === 'administrador' || req.user.role === 'super_administrador')) {
        return next();
    }
    return res.status(403).json({ success: false, message: 'Acceso restringido a administradores.' });
};

router.use(verifyToken);

/**
 * LISTAR TODOS LOS PAGOS (Solo Admin/SuperAdmin)
 * Esta es la tabla principal para tu contabilidad
 */
router.get('/all', isAdminRole, async (req, res) => {
    try {
        const query = `
            SELECT 
                p.*, 
                u.name as teacher_name, 
                u.email as teacher_email,
                ti.institution
            FROM payments p
            JOIN subscriptions s ON p.subscription_id = s.id
            JOIN teachers t ON s.teacher_id = t.id
            JOIN users u ON t.user_id = u.id
            LEFT JOIN teacher_institutions ti ON t.id = ti.teacher_id
            ORDER BY p.payment_date DESC`;
            
        const [payments] = await pool.query(query);
        res.json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * REGISTRAR PAGO MANUAL (Solo Admin/SuperAdmin)
 * Útil cuando te pagan por fuera o quieres corregir algo
 */
router.post('/manual-register', isAdminRole, async (req, res) => {
    const { subscription_id, amount, payment_method, status, transaction_id } = req.body;
    try {
        const [result] = await pool.query(
            `INSERT INTO payments (subscription_id, amount, payment_method, status, transaction_id, payment_date) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [subscription_id, amount, payment_method || 'manual', status || 'pending', transaction_id || null]
        );
        await logRequestAudit(req, {
            action: 'CREATE', tableName: 'payments', recordId: result.insertId,
            description: `Registró manualmente el pago ${result.insertId} para la suscripción ${subscription_id}.`,
            newValues: { subscription_id: Number(subscription_id), amount: Number(amount), payment_method: payment_method || 'manual', status: status || 'pending', transaction_id: transaction_id || null }
        });
        res.json({ success: true, message: 'Pago registrado', id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * ACTUALIZAR ESTADO DE PAGO (Validar Nequi)
 */
router.put('/:id/status', isAdminRole, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'success' o 'failed'
    try {
        const [existing] = await pool.query('SELECT status, subscription_id, amount FROM payments WHERE id = ?', [id]);
        if (!existing.length) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
        await pool.query('UPDATE payments SET status = ? WHERE id = ?', [status, id]);
        await logRequestAudit(req, {
            action: 'UPDATE', tableName: 'payments', recordId: Number(id),
            description: `Actualizó el estado del pago ${id}.`,
            oldValues: { status: existing[0].status }, newValues: { status }
        });
        res.json({ success: true, message: 'Estado de pago actualizado' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
