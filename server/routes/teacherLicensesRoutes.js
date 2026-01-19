// routes/teacherLicensesRoutes.js
// Gestión de licencias de docentes por institución

import express from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin, isSuperAdmin } from '../middleware/authMiddleware.js';

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
