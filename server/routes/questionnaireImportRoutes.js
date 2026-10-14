import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, createReadStream } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import pool from '../config/db.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware.js';
import { ensureSubjectCategoryExists } from '../utils/syncSubjectCategories.js';
import { hasQuestionnaireAccess } from '../utils/questionnaireAccess.js';
import { extractQuestionsFromDocx } from '../utils/docxQuestionExtractor.js';

const router = express.Router();
const documentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const writeFileAsync = promisify(writeFile);
const makeDirectoryAsync = promisify(mkdir);
const assetDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../private/questionnaire-assets');
const allowedRoles = new Set(['docente', 'administrador', 'admin', 'super_administrador']);
const answerLetters = new Set(['A', 'B', 'C', 'D']);
const rightsStates = new Set(['pending', 'original', 'licensed', 'replaced', 'exclude']);

const canManageBatch = async (req, batchId) => {
  const [rows] = await pool.query('SELECT * FROM questionnaire_import_batches WHERE id = ?', [batchId]);
  const batch = rows[0];
  if (!batch) return { batch: null, allowed: false };
  const isOwner = Number(batch.created_by_user_id) === Number(req.user.id);
  // El endpoint devuelve la clave y notas internas; una licencia de uso del
  // cuestionario nunca concede acceso al lote de revisión.
  return { batch, allowed: isOwner };
};

const normalizeItem = (row, index) => {
  const position = Number(row.position) > 0 ? Number(row.position) : index + 1;
  const questionText = String(row.question_text ?? row.enunciado ?? '').trim();
  if (!questionText) throw new Error(`La pregunta ${position} no tiene enunciado.`);
  const options = [1, 2, 3, 4].map((number) => {
    const value = row[`option${number}`] ?? row[String.fromCharCode(64 + number)] ?? '';
    return String(value).trim();
  });
  const answerRaw = String(row.correct_answer ?? row.respuesta_correcta ?? '').trim().toUpperCase();
  const correctAnswer = answerRaw
    ? (answerLetters.has(answerRaw) ? answerRaw : /^OPTION[1-4]$/.test(answerRaw) ? String.fromCharCode(64 + Number(answerRaw.slice(-1))) : null)
    : null;
  if (answerRaw && !correctAnswer) throw new Error(`Respuesta correcta inválida en la pregunta ${position}; usa A, B, C o D.`);
  return {
    position,
    sourceQuestionNumber: row.source_question_number ?? row.numero ?? null,
    sourceLocation: row.source_location ?? row.ubicacion_origen ?? null,
    questionText,
    options,
    correctAnswer,
    imageUrl: row.image_url ?? row.imagen_url ?? null,
    imageAssets: Array.isArray(row.image_assets) ? row.image_assets : [],
    imageReferences: row.image_references ?? row.referencias_imagen ?? null,
    rightsNotes: row.rights_notes ?? row.notas_derechos ?? null
  };
};

// Listar lotes visibles para el usuario autenticado.
router.get('/', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    let query = `
      SELECT b.*, u.name AS creator_name, t.user_id AS teacher_user_id,
        (SELECT COUNT(*) FROM questionnaire_import_items i WHERE i.batch_id = b.id) AS question_count,
        (SELECT COUNT(*) FROM questionnaire_import_items i WHERE i.batch_id = b.id AND i.review_status = 'approved') AS approved_count
      FROM questionnaire_import_batches b
      LEFT JOIN users u ON u.id = b.created_by_user_id
      LEFT JOIN teachers t ON t.id = b.teacher_id
    `;
    const params = [];
    query += ' WHERE b.created_by_user_id = ?';
    params.push(req.user.id);
    query += ' ORDER BY b.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error consultando importaciones de cuestionarios:', error);
    res.status(500).json({ success: false, message: 'No se pudieron consultar los borradores.' });
  }
});

// Analiza un DOCX en memoria y devuelve candidatos para que el docente revise antes de guardarlos.
router.post('/extract-docx', verifyToken, isTeacherOrAdmin, documentUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Selecciona un archivo DOCX.' });
    if (!req.file.originalname.toLowerCase().endsWith('.docx')) return res.status(400).json({ success: false, message: 'Este lector recibe archivos .docx.' });
    const extracted = extractQuestionsFromDocx(req.file.buffer);
    const referencedIds = new Set(extracted.items.flatMap((item) => {
      try {
        return JSON.parse(item.image_references || '[]').flatMap((ref) => ref.relationship_ids || []);
      } catch {
        return [];
      }
    }));
    const assetsByRelationship = new Map();
    await makeDirectoryAsync(assetDirectory, { recursive: true });
    for (const media of extracted.mediaFiles.filter((file) => referencedIds.has(file.relationship_id))) {
      const id = randomUUID();
      const extension = path.extname(media.filename).toLowerCase();
      const storedFilename = `${id}${extension}`;
      await writeFileAsync(path.join(assetDirectory, storedFilename), media.data, { flag: 'wx' });
      await pool.query(
        `INSERT INTO questionnaire_import_assets
          (id, owner_user_id, stored_filename, original_filename, mime_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, req.user.id, storedFilename, media.filename, media.mime_type, media.data.length]
      );
      assetsByRelationship.set(media.relationship_id, { id, url: `/questionnaire-imports/assets/${id}`, name: media.filename });
    }
    const items = extracted.items.map((item) => {
      let relationships = [];
      try {
        relationships = JSON.parse(item.image_references || '[]').flatMap((ref) => ref.relationship_ids || []);
      } catch { /* las referencias se conservan para revisión manual */ }
      const imageAssets = [...new Set(relationships)].map((relationshipId) => assetsByRelationship.get(relationshipId)).filter(Boolean);
      return { ...item, image_assets: imageAssets, image_url: imageAssets[0]?.url || '' };
    });
    const { mediaFiles, ...summary } = extracted;
    res.json({ success: true, filename: req.file.originalname, ...summary, items });
  } catch (error) {
    console.error('Error extrayendo preguntas de DOCX:', error);
    res.status(422).json({ success: false, message: error.message || 'No se pudo analizar el documento.' });
  }
});

// Sirve imágenes importadas desde almacenamiento privado y verifica acceso al borrador/producto.
router.get('/assets/:assetId', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM questionnaire_import_assets WHERE id = ?', [req.params.assetId]);
    const asset = rows[0];
    if (!asset) return res.status(404).json({ success: false, message: 'Imagen no encontrada.' });
    let allowed = Number(asset.owner_user_id) === Number(req.user.id);
    if (asset.questionnaire_id) {
      allowed = await hasQuestionnaireAccess(asset.questionnaire_id, req.user);
    } else if (asset.batch_id) {
      const [batches] = await pool.query('SELECT created_by_user_id FROM questionnaire_import_batches WHERE id = ?', [asset.batch_id]);
      allowed = batches.length > 0 && Number(batches[0].created_by_user_id) === Number(req.user.id);
    }
    if (!allowed) return res.status(403).json({ success: false, message: 'No tienes acceso a esta imagen.' });
    const absolutePath = path.resolve(assetDirectory, path.basename(asset.stored_filename));
    res.setHeader('Content-Type', asset.mime_type);
    res.setHeader('Content-Length', String(asset.file_size));
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(asset.original_filename)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    const stream = createReadStream(absolutePath);
    stream.on('error', (error) => {
      console.error('Error leyendo imagen privada de cuestionario:', error);
      if (!res.headersSent) res.status(404).json({ success: false, message: 'El archivo de imagen no está disponible.' });
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Error entregando imagen privada de cuestionario:', error);
    res.status(500).json({ success: false, message: 'No se pudo cargar la imagen.' });
  }
});

// Retorna todas las figuras extraídas que quedaron vinculadas a una pregunta publicada.
router.get('/published-question-assets/:questionId', verifyToken, async (req, res) => {
  try {
    const [questions] = await pool.query('SELECT questionnaire_id FROM questions WHERE id = ?', [req.params.questionId]);
    if (!questions.length) return res.status(404).json({ success: false, message: 'Pregunta no encontrada.' });
    if (!await hasQuestionnaireAccess(questions[0].questionnaire_id, req.user)) return res.status(403).json({ success: false, message: 'No tienes acceso a este material.' });
    const [assets] = await pool.query(
      `SELECT a.id, a.original_filename AS name, CONCAT('/questionnaire-imports/assets/', a.id) AS url, ia.position
       FROM questionnaire_import_items i
       JOIN questionnaire_import_item_assets ia ON ia.item_id = i.id
       JOIN questionnaire_import_assets a ON a.id = ia.asset_id
       WHERE i.published_question_id = ? ORDER BY ia.position`,
      [req.params.questionId]
    );
    res.json({ success: true, data: assets });
  } catch (error) {
    console.error('Error consultando figuras de pregunta publicada:', error);
    res.status(500).json({ success: false, message: 'No se pudieron cargar las figuras de la pregunta.' });
  }
});

// El superadministrador administra el acceso a cada cuestionario Saber 11 publicado.
router.get('/access-users', verifyToken, async (req, res) => {
  if (req.user.role !== 'super_administrador') return res.status(403).json({ success: false, message: 'Solo el superadministrador puede autorizar cuentas.' });
  const search = String(req.query.search || '').trim();
  if (search.length < 2) return res.json({ success: true, data: [] });
  try {
    const [users] = await pool.query(
      `SELECT id, name, email, role FROM users
       WHERE (name LIKE ? OR email LIKE ? OR CAST(id AS CHAR) = ?)
       ORDER BY name LIMIT 25`,
      [`%${search}%`, `%${search}%`, search]
    );
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error buscando cuentas para autorizar cuestionarios:', error);
    res.status(500).json({ success: false, message: 'No se pudieron buscar las cuentas.' });
  }
});

router.get('/access/:questionnaireId', verifyToken, async (req, res) => {
  if (req.user.role !== 'super_administrador') return res.status(403).json({ success: false, message: 'Solo el superadministrador puede administrar autorizaciones.' });
  try {
    const [product] = await pool.query(
      `SELECT r.owner_user_id, owner.name AS owner_name, owner.email AS owner_email, q.title
       FROM restricted_questionnaires r JOIN questionnaires q ON q.id = r.questionnaire_id
       JOIN users owner ON owner.id = r.owner_user_id WHERE r.questionnaire_id = ?`,
      [req.params.questionnaireId]
    );
    if (!product.length) return res.status(404).json({ success: false, message: 'Cuestionario privado no encontrado.' });
    if (Number(product[0].owner_user_id) !== Number(req.user.id)) return res.status(403).json({ success: false, message: 'Solo la cuenta propietaria puede administrar estas licencias.' });
    const [grants] = await pool.query(
      `SELECT g.user_id, u.name, u.email, u.role, g.status, g.granted_at, g.revoked_at
       FROM questionnaire_access_grants g JOIN users u ON u.id = g.user_id
       WHERE g.questionnaire_id = ? ORDER BY g.status = 'active' DESC, u.name`,
      [req.params.questionnaireId]
    );
    res.json({ success: true, data: { ...product[0], grants } });
  } catch (error) {
    console.error('Error cargando autorizaciones del cuestionario:', error);
    res.status(500).json({ success: false, message: 'No se pudieron cargar las autorizaciones.' });
  }
});

router.post('/access/:questionnaireId', verifyToken, async (req, res) => {
  if (req.user.role !== 'super_administrador') return res.status(403).json({ success: false, message: 'Solo el superadministrador puede autorizar cuentas.' });
  try {
    const userId = Number(req.body.user_id);
    const [product] = await pool.query('SELECT owner_user_id FROM restricted_questionnaires WHERE questionnaire_id = ?', [req.params.questionnaireId]);
    if (!product.length) return res.status(404).json({ success: false, message: 'Cuestionario privado no encontrado.' });
    if (Number(product[0].owner_user_id) !== Number(req.user.id)) return res.status(403).json({ success: false, message: 'Solo la cuenta propietaria puede administrar estas licencias.' });
    if (!userId || userId === Number(product[0].owner_user_id)) return res.status(400).json({ success: false, message: 'Selecciona una cuenta distinta al propietario.' });
    const [users] = await pool.query('SELECT id FROM users WHERE id = ? AND estado = \'activo\'', [userId]);
    if (!users.length) return res.status(404).json({ success: false, message: 'La cuenta no existe o está inactiva.' });
    await pool.query(
      `INSERT INTO questionnaire_access_grants (questionnaire_id, user_id, granted_by_user_id, status, granted_at, revoked_at)
       VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, NULL)
       ON DUPLICATE KEY UPDATE granted_by_user_id = VALUES(granted_by_user_id), status = 'active', granted_at = CURRENT_TIMESTAMP, revoked_at = NULL`,
      [req.params.questionnaireId, userId, req.user.id]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error autorizando cuenta para cuestionario:', error);
    res.status(500).json({ success: false, message: 'No se pudo autorizar la cuenta.' });
  }
});

router.delete('/access/:questionnaireId/:userId', verifyToken, async (req, res) => {
  if (req.user.role !== 'super_administrador') return res.status(403).json({ success: false, message: 'Solo el superadministrador puede revocar autorizaciones.' });
  try {
    const [product] = await pool.query('SELECT owner_user_id FROM restricted_questionnaires WHERE questionnaire_id = ?', [req.params.questionnaireId]);
    if (!product.length) return res.status(404).json({ success: false, message: 'Cuestionario privado no encontrado.' });
    if (Number(product[0].owner_user_id) !== Number(req.user.id)) return res.status(403).json({ success: false, message: 'Solo la cuenta propietaria puede administrar estas licencias.' });
    await pool.query(
      `UPDATE questionnaire_access_grants SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP
       WHERE questionnaire_id = ? AND user_id = ?`,
      [req.params.questionnaireId, req.params.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error revocando autorización:', error);
    res.status(500).json({ success: false, message: 'No se pudo revocar la autorización.' });
  }
});

// Crear lote y guardar hasta 500 preguntas como borradores sin clave de respuestas.
router.post('/', verifyToken, isTeacherOrAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { title, subject, category, teacher_id, source_filename, source_format, items } = req.body;
    if (!String(title || '').trim() || !String(subject || '').trim() || !Array.isArray(items) || !items.length || items.length > 500) {
      return res.status(400).json({ success: false, message: 'Indica título, materia y entre 1 y 500 preguntas.' });
    }
    if (!allowedRoles.has(req.user.role)) return res.status(403).json({ success: false, message: 'No tienes permiso para importar preguntas.' });
    const teacherId = req.user.role === 'docente' ? req.user.teacher_id : Number(teacher_id);
    if (!teacherId) return res.status(400).json({ success: false, message: 'Selecciona el perfil docente responsable del cuestionario.' });
    const [teachers] = await pool.query('SELECT id FROM teachers WHERE id = ?', [teacherId]);
    if (!teachers.length) return res.status(400).json({ success: false, message: 'El perfil docente seleccionado no existe.' });
    const normalized = items.map(normalizeItem);
    const normalizedCategory = String(category || 'Pre-ICFES').trim();

    await connection.beginTransaction();
    const [batchResult] = await connection.query(
      `INSERT INTO questionnaire_import_batches
        (title, subject, category, grade, phase, teacher_id, created_by_user_id, source_filename, source_format)
       VALUES (?, ?, ?, '11', '1', ?, ?, ?, ?)`,
      [String(title).trim(), String(subject).trim(), normalizedCategory, teacherId, req.user.id,
        source_filename ? String(source_filename).slice(0, 255) : null,
        source_format ? String(source_format).slice(0, 30) : null]
    );
    for (const item of normalized) {
      const [itemResult] = await connection.query(
        `INSERT INTO questionnaire_import_items
          (batch_id, position, source_question_number, source_location, question_text,
           option1, option2, option3, option4, correct_answer, image_url, image_references, rights_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [batchResult.insertId, item.position, item.sourceQuestionNumber, item.sourceLocation,
          item.questionText, ...item.options, item.correctAnswer,
          item.imageUrl ? String(item.imageUrl).slice(0, 2000) : null,
          typeof item.imageReferences === 'string' ? item.imageReferences : JSON.stringify(item.imageReferences || null),
          item.rightsNotes ? String(item.rightsNotes).slice(0, 4000) : null]
      );
      const assetIds = [...new Set(item.imageAssets.map((asset) => String(asset.id || '')).filter(Boolean))];
      if (assetIds.length) {
        const placeholders = assetIds.map(() => '?').join(',');
        const [ownedAssets] = await connection.query(
          `SELECT id FROM questionnaire_import_assets WHERE id IN (${placeholders}) AND owner_user_id = ? AND (batch_id IS NULL OR batch_id = ?) AND questionnaire_id IS NULL`,
          [...assetIds, req.user.id, batchResult.insertId]
        );
        if (ownedAssets.length !== assetIds.length) throw new Error(`Una o más imágenes de la pregunta ${item.position} ya no están disponibles para asociar.`);
        for (let index = 0; index < assetIds.length; index += 1) {
          await connection.query('INSERT INTO questionnaire_import_item_assets (item_id, asset_id, position) VALUES (?, ?, ?)', [itemResult.insertId, assetIds[index], index + 1]);
        }
        await connection.query(`UPDATE questionnaire_import_assets SET batch_id = ? WHERE id IN (${placeholders})`, [batchResult.insertId, ...assetIds]);
      }
    }
    await connection.commit();
    res.status(201).json({ success: true, data: { id: batchResult.insertId, question_count: normalized.length } });
  } catch (error) {
    await connection.rollback();
    const validationError = error.message?.startsWith('La pregunta') || error.message?.startsWith('Respuesta correcta');
    console.error('Error guardando borrador de importaciÃ³n de cuestionario:', error);
    const message = error.code === 'ER_NO_SUCH_TABLE'
      ? 'Falta aplicar la migraciÃ³n de revisiÃ³n o de imÃ¡genes en la base de datos.'
      : validationError ? error.message : 'No se pudo guardar el borrador. Revisa el error detallado en la terminal del servidor.';
    res.status(validationError ? 400 : 500).json({ success: false, message });
  } finally {
    connection.release();
  }
});

router.get('/:batchId', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { batch, allowed } = await canManageBatch(req, req.params.batchId);
    if (!batch) return res.status(404).json({ success: false, message: 'Borrador no encontrado.' });
    if (!allowed) return res.status(403).json({ success: false, message: 'No tienes acceso a este borrador.' });
    const [items] = await pool.query(
      `SELECT i.*, a.id AS asset_id, a.original_filename AS asset_name, CONCAT('/questionnaire-imports/assets/', a.id) AS asset_url, ia.position AS asset_position
       FROM questionnaire_import_items i
       LEFT JOIN questionnaire_import_item_assets ia ON ia.item_id = i.id
       LEFT JOIN questionnaire_import_assets a ON a.id = ia.asset_id
       WHERE i.batch_id = ? ORDER BY i.position, ia.position`, [batch.id]
    );
    const itemsWithAssets = [...new Map(items.map((row) => [row.id, row])).values()].map((row) => ({
      ...row,
      image_assets: items.filter((asset) => asset.id === row.id && asset.asset_id).map((asset) => ({ id: asset.asset_id, name: asset.asset_name, url: asset.asset_url, position: asset.asset_position }))
    }));
    res.json({ success: true, data: { ...batch, items: itemsWithAssets } });
  } catch (error) {
    console.error('Error consultando borrador de cuestionario:', error);
    res.status(500).json({ success: false, message: 'No se pudo abrir el borrador.' });
  }
});

// Borrar un borrador completo; las preguntas de staging se eliminan por CASCADE.
router.delete('/:batchId', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { batch, allowed } = await canManageBatch(req, req.params.batchId);
    if (!batch) return res.status(404).json({ success: false, message: 'Borrador no encontrado.' });
    if (!allowed || batch.status !== 'draft') return res.status(403).json({ success: false, message: 'Solo la cuenta propietaria puede eliminar un borrador sin publicar.' });
    await pool.query('DELETE FROM questionnaire_import_batches WHERE id = ?', [batch.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando borrador de importación:', error);
    res.status(500).json({ success: false, message: 'No se pudo eliminar el borrador.' });
  }
});

router.put('/:batchId/items/:itemId', verifyToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { batch, allowed } = await canManageBatch(req, req.params.batchId);
    if (!batch) return res.status(404).json({ success: false, message: 'Borrador no encontrado.' });
    if (!allowed || batch.status !== 'draft') return res.status(403).json({ success: false, message: 'No puedes modificar este borrador.' });
    const [found] = await pool.query('SELECT * FROM questionnaire_import_items WHERE id = ? AND batch_id = ?', [req.params.itemId, batch.id]);
    if (!found.length) return res.status(404).json({ success: false, message: 'Pregunta no encontrada.' });
    const current = found[0];
    const answer = req.body.correct_answer === '' || req.body.correct_answer === null
      ? null : String(req.body.correct_answer || '').toUpperCase();
    if (answer && !answerLetters.has(answer)) return res.status(400).json({ success: false, message: 'La respuesta debe ser A, B, C o D.' });
    const rights = req.body.rights_status ?? current.rights_status;
    if (!rightsStates.has(rights)) return res.status(400).json({ success: false, message: 'Estado de derechos inválido.' });
    const review = req.body.review_status ?? current.review_status;
    if (!['pending', 'approved', 'rejected'].includes(review)) return res.status(400).json({ success: false, message: 'Estado de revisión inválido.' });
    if (review === 'approved' && (!answer || rights === 'pending' || rights === 'exclude' || [1, 2, 3, 4].some((number) => !String(req.body[`option${number}`] ?? current[`option${number}`] ?? '').trim()))) {
      return res.status(400).json({ success: false, message: 'Para aprobar, completa las cuatro opciones, verifica la respuesta y confirma la procedencia.' });
    }
    const answerVerified = req.body.answer_verified === true;
    const answerWasChanged = answer !== current.correct_answer;
    const updated = {
      question_text: String(req.body.question_text ?? current.question_text).trim(),
      option1: String(req.body.option1 ?? current.option1).trim(),
      option2: String(req.body.option2 ?? current.option2).trim(),
      option3: String(req.body.option3 ?? current.option3).trim(),
      option4: String(req.body.option4 ?? current.option4).trim(),
      correct_answer: answer,
      answer_status: answer ? (answerVerified ? 'verified' : answerWasChanged ? 'pending' : current.answer_status) : 'pending',
      rights_status: rights,
      rights_notes: req.body.rights_notes ?? current.rights_notes,
      source_location: req.body.source_location ?? current.source_location,
      image_url: req.body.image_url ?? current.image_url,
      review_status: review
    };
    if (!updated.question_text || (review === 'approved' && [updated.option1, updated.option2, updated.option3, updated.option4].some((value) => !value))) {
      return res.status(400).json({ success: false, message: 'Para aprobar una pregunta, completa el enunciado y las cuatro opciones.' });
    }
    if (review === 'approved' && updated.answer_status !== 'verified') {
      return res.status(400).json({ success: false, message: 'Marca la respuesta como verificada antes de aprobar la pregunta.' });
    }
    await pool.query(
      `UPDATE questionnaire_import_items
       SET question_text = ?, option1 = ?, option2 = ?, option3 = ?, option4 = ?, correct_answer = ?,
           answer_status = ?, rights_status = ?, rights_notes = ?, source_location = ?, image_url = ?, review_status = ?
       WHERE id = ? AND batch_id = ?`,
      [updated.question_text, updated.option1, updated.option2, updated.option3, updated.option4,
        updated.correct_answer, updated.answer_status, updated.rights_status, updated.rights_notes,
        updated.source_location, updated.image_url, updated.review_status, current.id, batch.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando pregunta importada:', error);
    res.status(500).json({ success: false, message: 'No se pudo guardar la revisión.' });
  }
});

// La activación final queda solo en manos del superadministrador.
router.post('/:batchId/publish', verifyToken, async (req, res) => {
  if (req.user.role !== 'super_administrador') return res.status(403).json({ success: false, message: 'Solo el superadministrador puede activar este cuestionario.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [batches] = await connection.query('SELECT * FROM questionnaire_import_batches WHERE id = ? FOR UPDATE', [req.params.batchId]);
    const batch = batches[0];
    if (!batch) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Borrador no encontrado.' });
    }
    if (batch.status !== 'draft') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Este borrador ya fue publicado.' });
    }
    if (Number(batch.created_by_user_id) !== Number(req.user.id)) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Solo quien creó el borrador puede activar su cuestionario privado.' });
    }
    const [items] = await connection.query('SELECT * FROM questionnaire_import_items WHERE batch_id = ? ORDER BY position FOR UPDATE', [batch.id]);
    const blocked = items.filter((item) => item.review_status === 'pending' || item.review_status === 'approved' && (!item.correct_answer || item.answer_status !== 'verified' || item.rights_status === 'pending' || [item.option1, item.option2, item.option3, item.option4].some((option) => !String(option || '').trim())));
    const approved = items.filter((item) => item.review_status === 'approved' && item.answer_status === 'verified' && item.correct_answer && ['original', 'licensed', 'replaced'].includes(item.rights_status));
    const excluded = items.filter((item) => item.review_status === 'rejected' || item.rights_status === 'exclude');
    if (blocked.length || !approved.length || approved.length + excluded.length !== items.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Revisa cada pregunta: debe estar aprobada o excluida, con respuesta verificada y derechos definidos.', pending_count: blocked.length });
    }
    await ensureSubjectCategoryExists(batch.subject, batch.category);
    const [questionnaireResult] = await connection.query(
      `INSERT INTO questionnaires
        (title, subject, category, grade, phase, course_id, questions_to_answer, time_limit_minutes,
         created_by, description, is_prueba_saber, prueba_saber_level)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 1, 11)`,
      [batch.title, batch.subject, batch.category, batch.grade, batch.phase, batch.teacher_id,
        `Importación revisada desde ${batch.source_filename || 'material de docente'}.`]
    );
    for (const item of approved) {
      const optionNumber = item.correct_answer.charCodeAt(0) - 64;
      const [questionResult] = await connection.query(
        `INSERT INTO questions
          (questionnaire_id, question_text, option1, option2, option3, option4, correct_answer, category, image_url, is_prueba_saber, prueba_saber_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 11)`,
        [questionnaireResult.insertId, item.question_text, item.option1, item.option2, item.option3, item.option4,
          `option${optionNumber}`, batch.category, item.image_url]
      );
      await connection.query('UPDATE questionnaire_import_items SET published_question_id = ? WHERE id = ?', [questionResult.insertId, item.id]);
      await connection.query(
        `UPDATE questionnaire_import_assets a JOIN questionnaire_import_item_assets ia ON ia.asset_id = a.id
         SET a.questionnaire_id = ?, a.batch_id = NULL WHERE ia.item_id = ?`,
        [questionnaireResult.insertId, item.id]
      );
    }
    await connection.query(
      'INSERT INTO restricted_questionnaires (questionnaire_id, owner_user_id) VALUES (?, ?)',
      [questionnaireResult.insertId, req.user.id]
    );
    await connection.query(
      'UPDATE questionnaire_import_batches SET status = \'published\', published_questionnaire_id = ? WHERE id = ?',
      [questionnaireResult.insertId, batch.id]
    );
    await connection.commit();
    res.json({ success: true, questionnaire_id: questionnaireResult.insertId, published_questions: approved.length, excluded_questions: excluded.length });
  } catch (error) {
    await connection.rollback();
    console.error('Error publicando lote importado:', error);
    res.status(500).json({ success: false, message: 'No se pudo activar el cuestionario.' });
  } finally {
    connection.release();
  }
});

export default router;
