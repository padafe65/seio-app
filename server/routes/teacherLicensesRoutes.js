// routes/teacherLicensesRoutes.js
// Gestión de licencias de docentes por institución

import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin, isSuperAdmin } from '../middleware/authMiddleware.js';
import { logRequestAudit } from '../utils/auditLogger.js';

const router = express.Router();

// Middleware para verificar si es admin o super_admin
const isAdminOrSuperAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'administrador' || req.user.role === 'super_administrador')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Acceso denegado. Se requieren privilegios de administrador o super administrador.',
    code: 'ADMIN_ACCESS_REQUIRED',
    userRole: req.user?.role
  });
};

// Aplicar verificación de token a todas las rutas
router.use(verifyToken);

/**
 * Obtener todas las licencias de un docente (puede ver sus propias licencias)
 */
router.get('/teacher/:teacherId/licenses', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Si no es admin/super_admin, verificar que el docente esté consultando sus propias licencias
    if (userRole !== 'administrador' && userRole !== 'super_administrador') {
      const [teacher] = await pool.query(
        'SELECT user_id FROM teachers WHERE id = ?',
        [teacherId]
      );

      if (teacher.length === 0 || teacher[0].user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes ver tus propias licencias'
        });
      }
    }

    const [licenses] = await pool.query(
      `SELECT 
        ti.*,
        u.name as teacher_name,
        t.subject as teacher_subject
      FROM teacher_institutions ti
      JOIN teachers t ON ti.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE ti.teacher_id = ?
      ORDER BY ti.license_status, ti.institution`,
      [teacherId]
    );

    res.json({
      success: true,
      data: licenses
    });
  } catch (error) {
    console.error('❌ Error al obtener licencias del docente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener licencias del docente',
      error: error.message
    });
  }
});

/**
 * Obtener licencia específica por institución
 */
router.get('/teacher/:teacherId/institution/:institution', async (req, res) => {
  try {
    const { teacherId, institution } = req.params;
    if (!['admin', 'administrador', 'super_administrador'].includes(req.user.role)) {
      const [teacher] = await pool.query('SELECT user_id FROM teachers WHERE id = ?', [teacherId]);
      if (!teacher.length || Number(teacher[0].user_id) !== Number(req.user.id)) {
        return res.status(403).json({ success: false, message: 'Solo puedes consultar tus propias licencias.' });
      }
    }

    const [licenses] = await pool.query(
      'SELECT * FROM teacher_institutions WHERE teacher_id = ? AND institution = ?',
      [teacherId, institution]
    );

    if (licenses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Licencia no encontrada'
      });
    }

    res.json({
      success: true,
      data: licenses[0]
    });
  } catch (error) {
    console.error('❌ Error al obtener licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener licencia',
      error: error.message
    });
  }
});

/**
 * Comprar/Agregar nueva licencia para un docente (solo administradores)
 * Calcula automáticamente la fecha de expiración a un año después
 */
router.post('/teacher/:teacherId/purchase-license', isAdminOrSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { teacherId } = req.params;
    const { institution, purchased_date } = req.body;

    if (!institution) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'El campo institution es obligatorio'
      });
    }

    // Verificar que el docente existe
    const [teacher] = await connection.query(
      'SELECT id FROM teachers WHERE id = ?',
      [teacherId]
    );

    if (teacher.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Docente no encontrado'
      });
    }

    // Verificar si la licencia ya existe
    const [existingLicense] = await connection.query(
      'SELECT id, license_status FROM teacher_institutions WHERE teacher_id = ? AND institution = ?',
      [teacherId, institution]
    );

    if (existingLicense.length > 0) {
      // Si ya existe pero está suspendida/expirada, reactivarla
      if (existingLicense[0].license_status !== 'active') {
        const purchaseDate = purchased_date ? new Date(purchased_date) : new Date();
        const expirationDate = new Date(purchaseDate);
        expirationDate.setFullYear(expirationDate.getFullYear() + 1); // Un año después

        await connection.query(
          `UPDATE teacher_institutions 
           SET license_status = 'active',
               purchased_date = ?,
               expiration_date = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [purchaseDate.toISOString().split('T')[0], expirationDate.toISOString().split('T')[0], existingLicense[0].id]
        );

        // Actualizar contadores
        await connection.query(
          `UPDATE teachers 
           SET active_licenses = (
             SELECT COUNT(*) FROM teacher_institutions 
             WHERE teacher_id = ? AND license_status = 'active'
           )
           WHERE id = ?`,
          [teacherId, teacherId]
        );

        await connection.commit();
        await logRequestAudit(req, {
          action: 'UPDATE', tableName: 'teacher_institutions', recordId: existingLicense[0].id,
          description: `Reactivó la licencia del docente ${teacherId} para ${institution}.`,
          oldValues: { license_status: existingLicense[0].license_status },
          newValues: { license_status: 'active', purchased_date: purchaseDate.toISOString().split('T')[0], expiration_date: expirationDate.toISOString().split('T')[0] }
        });

        return res.json({
          success: true,
          message: 'Licencia reactivada exitosamente',
          data: {
            teacher_id: teacherId,
            institution,
            license_status: 'active',
            purchased_date: purchaseDate.toISOString().split('T')[0],
            expiration_date: expirationDate.toISOString().split('T')[0]
          }
        });
      } else {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Este docente ya tiene una licencia activa para esta institución'
        });
      }
    }

    // Calcular fecha de expiración (un año después de la compra)
    const purchaseDate = purchased_date ? new Date(purchased_date) : new Date();
    const expirationDate = new Date(purchaseDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1); // Un año después

    // Crear nueva licencia
    const [result] = await connection.query(
      `INSERT INTO teacher_institutions 
       (teacher_id, institution, license_status, purchased_date, expiration_date) 
       VALUES (?, ?, 'active', ?, ?)`,
      [
        teacherId,
        institution,
        purchaseDate.toISOString().split('T')[0],
        expirationDate.toISOString().split('T')[0]
      ]
    );

    // Actualizar contadores en teachers
    await connection.query(
      `UPDATE teachers 
       SET total_licenses = (
         SELECT COUNT(*) FROM teacher_institutions WHERE teacher_id = ?
       ),
       active_licenses = (
         SELECT COUNT(*) FROM teacher_institutions 
         WHERE teacher_id = ? AND license_status = 'active'
       )
       WHERE id = ?`,
      [teacherId, teacherId, teacherId]
    );

    await connection.commit();
    await logRequestAudit(req, {
      action: 'CREATE', tableName: 'teacher_institutions', recordId: result.insertId,
      description: `Creó una licencia para el docente ${teacherId} en ${institution}.`,
      newValues: { teacher_id: Number(teacherId), institution, license_status: 'active', purchased_date: purchaseDate.toISOString().split('T')[0], expiration_date: expirationDate.toISOString().split('T')[0] }
    });

    res.status(201).json({
      success: true,
      message: 'Licencia comprada exitosamente',
      data: {
        id: result.insertId,
        teacher_id: teacherId,
        institution,
        license_status: 'active',
        purchased_date: purchaseDate.toISOString().split('T')[0],
        expiration_date: expirationDate.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al comprar licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al comprar licencia',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * Suspender licencia (solo administradores/super_administradores)
 * NO elimina información del docente ni estudiantes
 */
router.put('/license/:licenseId/suspend', isAdminOrSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { licenseId } = req.params;
    const { reason } = req.body;

    // Verificar que la licencia existe
    const [license] = await connection.query(
      'SELECT teacher_id, institution, license_status FROM teacher_institutions WHERE id = ?',
      [licenseId]
    );

    if (license.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Licencia no encontrada'
      });
    }

    if (license[0].license_status === 'suspended') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'La licencia ya está suspendida'
      });
    }

    const teacherId = license[0].teacher_id;

    // Suspender la licencia (NO se borran datos del docente ni estudiantes)
    await connection.query(
      `UPDATE teacher_institutions 
       SET license_status = 'suspended',
           updated_at = NOW()
       WHERE id = ?`,
      [licenseId]
    );

    // Actualizar contador de licencias activas
    await connection.query(
      `UPDATE teachers 
       SET active_licenses = (
         SELECT COUNT(*) FROM teacher_institutions 
         WHERE teacher_id = ? AND license_status = 'active'
       )
       WHERE id = ?`,
      [teacherId, teacherId]
    );

    await connection.commit();

    await logRequestAudit(req, {
      action: 'UPDATE', tableName: 'teacher_institutions', recordId: Number(licenseId),
      description: `Suspendió la licencia del docente ${teacherId} para ${license[0].institution}.`,
      oldValues: { license_status: license[0].license_status }, newValues: { license_status: 'suspended', reason: reason || null }
    });

    console.log(`🔒 Licencia ${licenseId} suspendida. Razón: ${reason || 'No especificada'}`);
    console.log(`⚠️ IMPORTANTE: Los datos del docente y estudiantes NO fueron eliminados.`);

    res.json({
      success: true,
      message: `Licencia suspendida exitosamente. Los datos del docente y estudiantes se mantienen intactos.${reason ? ` Razón: ${reason}` : ''}`,
      data: {
        license_id: licenseId,
        teacher_id: teacherId,
        institution: license[0].institution,
        license_status: 'suspended',
        reason: reason || null
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al suspender licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al suspender licencia',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

router.put('/license/:licenseId/reactivate', isAdminOrSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { licenseId } = req.params;
    const { plan_type } = req.body; // 'monthly' o 'yearly'

    const [license] = await connection.query(
      'SELECT teacher_id, expiration_date, purchased_date FROM teacher_institutions WHERE id = ?',
      [licenseId]
    );

    if (license.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Licencia no encontrada' });
    }

    const today = new Date();
    let baseDate = new Date();
    const currentExp = license[0].expiration_date ? new Date(license[0].expiration_date) : null;
    
    // 1. Determinar la duración del plan solicitado
    const daysToAdd = (plan_type === 'yearly') ? 365 : 30;

    // 2. LÓGICA DE SUMA O RESETEO
    // Si la licencia tiene días vigentes y es la PRIMERA VEZ (se asume por el mes gratis)
    // Para identificar si es el periodo inicial, miramos si la fecha de compra es igual a cuando se creó
    // O simplemente si la fecha de expiración es menor a 31 días desde su creación.
    
    if (currentExp && currentExp > today) {
        // Si le quedan días, sumamos los días del plan a la fecha de expiración actual
        baseDate = currentExp;
    } else {
        // Si ya venció o está suspendida, empezamos desde hoy
        baseDate = today;
    }

    let newExpiration = new Date(baseDate);
    newExpiration.setDate(newExpiration.getDate() + daysToAdd);

    // 3. APLICAR EL TOPE (Regla de negocio principal)
    // El tiempo restante total NO puede ser mayor a (Plan contratado + 30 días de regalo máximo)
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + daysToAdd + 30); // Tope: Plan + mes de gracia

    if (newExpiration > maxDate) {
        newExpiration = maxDate;
    }

    const finalDateStr = newExpiration.toISOString().split('T')[0];

    // 4. Actualizar DB
    await connection.query(
      `UPDATE teacher_institutions 
       SET license_status = 'active',
           expiration_date = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [finalDateStr, licenseId]
    );

    await connection.query(
      "UPDATE teachers SET active_licenses = (SELECT COUNT(*) FROM teacher_institutions WHERE teacher_id = ? AND license_status = 'active') WHERE id = ?",
      [license[0].teacher_id, license[0].teacher_id]
    );

    await connection.commit();
    await logRequestAudit(req, {
      action: 'UPDATE', tableName: 'teacher_institutions', recordId: Number(licenseId),
      description: `Reactivó la licencia ${licenseId}.`,
      oldValues: { expiration_date: license[0].expiration_date },
      newValues: { license_status: 'active', expiration_date: finalDateStr, plan_type: plan_type === 'yearly' ? 'yearly' : 'monthly' }
    });
    res.json({ 
        success: true, 
        message: 'Licencia actualizada con éxito', 
        new_expiration: finalDateStr 
    });

  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

router.get('/licenses', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { status, institution, teacher_id } = req.query;

    let query = `
      SELECT 
        ti.*,
        t.subject as teacher_subject,
        u.name as teacher_name,
        u.email as teacher_email,
        (SELECT p.proof_image_url 
         FROM payments p 
         JOIN subscriptions s ON p.subscription_id = s.id 
         WHERE s.teacher_id = ti.teacher_id 
         ORDER BY p.payment_date DESC, p.id DESC LIMIT 1) as proof_image_url
      FROM teacher_institutions ti
      JOIN teachers t ON ti.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ' AND ti.license_status = ?';
      params.push(status);
    }

    if (institution) {
      query += ' AND ti.institution LIKE ?';
      params.push(`%${institution}%`);
    }

    if (teacher_id) {
      query += ' AND ti.teacher_id = ?';
      params.push(teacher_id);
    }

    query += ' ORDER BY ti.updated_at DESC';

    const [licenses] = await pool.query(query, params);

    res.json({
      success: true,
      count: licenses.length,
      data: licenses
    });
  } catch (error) {
    console.error('❌ Error en SQL:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener licencias',
      error: error.message
    });
  }
});

/**
 * Reactivar licencia (solo administradores/super_administradores)
 * Se usa cuando el docente paga la mensualidad/anualidad
 */
router.put('/license/:licenseId/reactivate', isAdminOrSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { licenseId } = req.params;
    const { extend_year = true } = req.body; // Por defecto extiende un año más

    // Verificar que la licencia existe
    const [license] = await connection.query(
      'SELECT teacher_id, institution, license_status, expiration_date FROM teacher_institutions WHERE id = ?',
      [licenseId]
    );

    if (license.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Licencia no encontrada'
      });
    }

    const teacherId = license[0].teacher_id;

    // Calcular nueva fecha de expiración si se extiende
    let newExpirationDate = null;
    if (extend_year) {
      const baseDate = license[0].expiration_date ? new Date(license[0].expiration_date) : new Date();
      newExpirationDate = new Date(baseDate);
      newExpirationDate.setFullYear(newExpirationDate.getFullYear() + 1);
    }

    // Reactivar la licencia
    const updateQuery = extend_year
      ? `UPDATE teacher_institutions 
         SET license_status = 'active',
             expiration_date = ?,
             purchased_date = COALESCE(purchased_date, CURDATE()),
             updated_at = NOW()
         WHERE id = ?`
      : `UPDATE teacher_institutions 
         SET license_status = 'active',
             updated_at = NOW()
         WHERE id = ?`;

    const updateParams = extend_year
      ? [newExpirationDate.toISOString().split('T')[0], licenseId]
      : [licenseId];

    await connection.query(updateQuery, updateParams);

    // Actualizar contador de licencias activas
    await connection.query(
      `UPDATE teachers 
       SET active_licenses = (
         SELECT COUNT(*) FROM teacher_institutions 
         WHERE teacher_id = ? AND license_status = 'active'
       )
       WHERE id = ?`,
      [teacherId, teacherId]
    );

    await connection.commit();

    await logRequestAudit(req, {
      action: 'UPDATE', tableName: 'teacher_institutions', recordId: Number(licenseId),
      description: `Reactivó la licencia del docente ${teacherId} para ${license[0].institution}.`,
      oldValues: { license_status: license[0].license_status, expiration_date: license[0].expiration_date },
      newValues: { license_status: 'active', expiration_date: newExpirationDate ? newExpirationDate.toISOString().split('T')[0] : license[0].expiration_date }
    });

    console.log(`✅ Licencia ${licenseId} reactivada exitosamente`);

    res.json({
      success: true,
      message: 'Licencia reactivada exitosamente',
      data: {
        license_id: licenseId,
        teacher_id: teacherId,
        institution: license[0].institution,
        license_status: 'active',
        expiration_date: newExpirationDate ? newExpirationDate.toISOString().split('T')[0] : license[0].expiration_date
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al reactivar licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reactivar licencia',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * Marcar licencia como expirada (automático o manual)
 */
router.put('/license/:licenseId/expire', isAdminOrSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { licenseId } = req.params;

    const [license] = await connection.query(
      'SELECT teacher_id FROM teacher_institutions WHERE id = ?',
      [licenseId]
    );

    if (license.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Licencia no encontrada'
      });
    }

    const teacherId = license[0].teacher_id;

    await connection.query(
      `UPDATE teacher_institutions 
       SET license_status = 'expired',
           updated_at = NOW()
       WHERE id = ?`,
      [licenseId]
    );

    // Actualizar contador
    await connection.query(
      `UPDATE teachers 
       SET active_licenses = (
         SELECT COUNT(*) FROM teacher_institutions 
         WHERE teacher_id = ? AND license_status = 'active'
       )
       WHERE id = ?`,
      [teacherId, teacherId]
    );

    await connection.commit();

    await logRequestAudit(req, {
      action: 'UPDATE', tableName: 'teacher_institutions', recordId: Number(licenseId),
      description: `Marcó como expirada la licencia ${licenseId}.`,
      oldValues: { teacher_id: license[0].teacher_id }, newValues: { license_status: 'expired' }
    });

    res.json({
      success: true,
      message: 'Licencia marcada como expirada',
      data: { license_id: licenseId, license_status: 'expired' }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al expirar licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al expirar licencia',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * Obtener todas las licencias (solo administradores) con filtros
 */
router.get('/licenses', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { status, institution, teacher_id } = req.query;

    let query = `
      SELECT 
        ti.*,
        t.id as teacher_table_id,
        t.subject,
        u.name as teacher_name,
        u.email as teacher_email,
        t.total_licenses,
        t.active_licenses
      FROM teacher_institutions ti
      JOIN teachers t ON ti.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ' AND ti.license_status = ?';
      params.push(status);
    }

    if (institution) {
      query += ' AND ti.institution LIKE ?';
      params.push(`%${institution}%`);
    }

    if (teacher_id) {
      query += ' AND ti.teacher_id = ?';
      params.push(teacher_id);
    }

    query += ' ORDER BY ti.updated_at DESC, ti.institution';

    const [licenses] = await pool.query(query, params);

    res.json({
      success: true,
      count: licenses.length,
      data: licenses
    });
  } catch (error) {
    console.error('❌ Error al obtener licencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener licencias',
      error: error.message
    });
  }
});

/**
 * Verificar y actualizar automáticamente licencias expiradas
 * (Ejecutar periódicamente, por ejemplo con un cron job)
 */
router.post('/licenses/check-expired', isAdminOrSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Buscar licencias activas cuya fecha de expiración ya pasó
    const [expiredLicenses] = await connection.query(
      `SELECT id, teacher_id 
       FROM teacher_institutions 
       WHERE license_status = 'active' 
         AND expiration_date IS NOT NULL 
         AND expiration_date < CURDATE()`
    );

    if (expiredLicenses.length > 0) {
      // Marcar como expiradas
      await connection.query(
        `UPDATE teacher_institutions 
         SET license_status = 'expired',
             updated_at = NOW()
         WHERE license_status = 'active' 
           AND expiration_date IS NOT NULL 
           AND expiration_date < CURDATE()`
      );

      // Actualizar contadores de todos los docentes afectados
      const teacherIds = [...new Set(expiredLicenses.map(l => l.teacher_id))];
      
      for (const teacherId of teacherIds) {
        await connection.query(
          `UPDATE teachers 
           SET active_licenses = (
             SELECT COUNT(*) FROM teacher_institutions 
             WHERE teacher_id = ? AND license_status = 'active'
           )
           WHERE id = ?`,
          [teacherId, teacherId]
        );
      }

      await connection.commit();

      await logRequestAudit(req, {
        action: 'UPDATE', tableName: 'teacher_institutions', recordId: null,
        description: `Marcó ${expiredLicenses.length} licencia(s) vencida(s) automáticamente.`,
        newValues: { expired_license_ids: expiredLicenses.map(license => license.id), count: expiredLicenses.length }
      });

      res.json({
        success: true,
        message: `${expiredLicenses.length} licencia(s) marcada(s) como expirada(s)`,
        expired_count: expiredLicenses.length,
        data: expiredLicenses
      });
    } else {
      await connection.commit();
      res.json({
        success: true,
        message: 'No hay licencias expiradas',
        expired_count: 0
      });
    }

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al verificar licencias expiradas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar licencias expiradas',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

export default router;
