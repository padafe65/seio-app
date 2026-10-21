import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assetDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../private/questionnaire-assets');

const isAssetStillUsed = async (db, assetId) => {
  const [links] = await db.query(
    'SELECT 1 FROM questionnaire_import_item_assets WHERE asset_id = ? LIMIT 1',
    [assetId]
  );
  if (links.length) return true;

  const [questions] = await db.query(
    'SELECT 1 FROM questions WHERE LOCATE(BINARY ?, BINARY image_url) > 0 LIMIT 1',
    [`/questionnaire-imports/assets/${assetId}`]
  );
  return questions.length > 0;
};

// Deletes only assets with no remaining imported-question or published-question references.
export const deleteUnusedQuestionnaireAssets = async (db, assetIds = []) => {
  const result = { deleted: 0, retained: 0, missingFiles: 0, fileErrors: 0 };
  for (const assetId of [...new Set(assetIds.filter(Boolean).map(String))]) {
    const [rows] = await db.query('SELECT id, stored_filename FROM questionnaire_import_assets WHERE id = ?', [assetId]);
    const asset = rows[0];
    if (!asset) continue;
    if (await isAssetStillUsed(db, asset.id)) {
      result.retained += 1;
      continue;
    }

    await db.query('DELETE FROM questionnaire_import_assets WHERE id = ?', [asset.id]);
    const filename = path.basename(asset.stored_filename);
    const absolutePath = path.resolve(assetDirectory, filename);
    if (path.dirname(absolutePath) !== assetDirectory) {
      result.fileErrors += 1;
      console.error(`No se eliminó una imagen importada por ruta fuera de la carpeta: ${asset.id}`);
      continue;
    }
    try {
      await unlink(absolutePath);
      result.deleted += 1;
    } catch (error) {
      if (error.code === 'ENOENT') result.missingFiles += 1;
      else {
        result.fileErrors += 1;
        console.error(`No se pudo eliminar el archivo de imagen importada ${asset.id}:`, error);
      }
    }
  }
  return result;
};

export const getAssetsForQuestionnaire = async (db, questionnaireId) => {
  const [rows] = await db.query(
    `SELECT DISTINCT a.id
     FROM questionnaire_import_assets a
     LEFT JOIN questionnaire_import_item_assets ia ON ia.asset_id = a.id
     LEFT JOIN questionnaire_import_items i ON i.id = ia.item_id
     LEFT JOIN questionnaire_import_batches b ON b.id = i.batch_id
     LEFT JOIN questionnaire_import_batches owned_batch ON owned_batch.id = a.batch_id
     WHERE a.questionnaire_id = ?
        OR b.published_questionnaire_id = ?
        OR owned_batch.published_questionnaire_id = ?`,
    [questionnaireId, questionnaireId, questionnaireId]
  );
  return rows.map((row) => row.id);
};
