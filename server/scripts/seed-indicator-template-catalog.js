#!/usr/bin/env node
/** Copy the existing internal suggestions into the isolated database catalog. */
import { createHash } from 'node:crypto';
import pool from '../config/db.js';
import { getTemplateIndicators, getTemplateSubjects } from '../data/subjectTemplates.js';

const schoolSubjects = new Set(['Matemáticas', 'Inglés', 'Español', 'Física 1', 'Química']);
const subjectAliases = {
  'Matemáticas 2': 'Matemáticas',
  'Cálculo': 'Cálculo Diferencial 1',
  'Cálculo Diferencial': 'Cálculo Diferencial 1',
  'Seguros Básico': 'Seguros'
};

const slug = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const hashItem = (item) => createHash('sha256')
  .update(`${item.description}\n${item.category || ''}\n${item.phase}`)
  .digest('hex');

async function upsertPackage(db, { packageKey, title, subject, educationLevel, gradeLabel }) {
  const [result] = await db.query(
    `INSERT INTO indicator_template_packages
      (package_key, title, subject, education_level, assessment_framework, grade_label,
       version, status, authorship_label, editorial_note)
     VALUES (?, ?, ?, ?, 'none', ?, 1, 'published', ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), title = VALUES(title),
       subject = VALUES(subject), education_level = VALUES(education_level),
       assessment_framework = VALUES(assessment_framework), grade_label = VALUES(grade_label),
       status = VALUES(status), authorship_label = VALUES(authorship_label),
       editorial_note = VALUES(editorial_note)`,
    [
      packageKey,
      title,
      subject,
      educationLevel,
      gradeLabel,
      'Propuesta interna SEIO; pendiente de revisión editorial',
      'Contenido legado del proyecto, no transcripción oficial. Alcance general de la asignatura; validar antes de crear paquetes específicos por grado o examen.'
    ]
  );
  return result.insertId;
}

async function insertItems(db, packageId, items, sourceId) {
  for (const item of items) {
    const contentHash = hashItem(item);
    const [result] = await db.query(
      `INSERT INTO indicator_template_items
        (package_id, description, content_hash, category, phase, status, authoring_note)
       VALUES (?, ?, ?, ?, ?, 'published', ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), description = VALUES(description),
         category = VALUES(category), phase = VALUES(phase), status = VALUES(status),
         authoring_note = VALUES(authoring_note)`,
      [packageId, item.description, contentHash, item.category || null, item.phase,
        'Contenido interno preexistente; revisar autoría, alcance por grado y alineación antes de ampliar o atribuir una fuente oficial.']
    );
    await db.query(
      `INSERT IGNORE INTO indicator_template_item_sources
        (template_item_id, source_id, relationship_type, locator)
       VALUES (?, ?, 'internal_authorship', 'Catálogo legado del proyecto')`,
      [result.insertId, sourceId]
    );
  }
}

async function run() {
  let connection;
  try {
    const [databaseRows] = await pool.query('SELECT DATABASE() AS database_name');
    if (databaseRows[0]?.database_name !== 'seio_db_pruebas') {
      throw new Error(`Safety stop: connected database is "${databaseRows[0]?.database_name || 'unknown'}". Expected "seio_db_pruebas".`);
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [sourceRows] = await connection.query(
      'SELECT id FROM indicator_template_sources WHERE source_key = ?',
      ['seio-legacy-templates']
    );
    if (!sourceRows.length) throw new Error('Run the template catalog migration before seeding.');
    const sourceId = sourceRows[0].id;

    for (const subject of getTemplateSubjects()) {
      const educationLevel = schoolSubjects.has(subject) ? 'school' : 'professional';
      const packageKey = `legacy:${slug(subject)}:${educationLevel}:general`;
      const title = `${subject} — plantilla general`;
      const packageId = await upsertPackage(connection, {
        packageKey,
        title,
        subject,
        educationLevel,
        gradeLabel: 'general'
      });
      await insertItems(connection, packageId, getTemplateIndicators(subject), sourceId);

      if (subject === 'Matemáticas') {
        const gradeSixId = await upsertPackage(connection, {
          packageKey: 'legacy:matematicas:school:grade-6',
          title: 'Matemáticas — grado 6',
          subject,
          educationLevel: 'school',
          gradeLabel: '6'
        });
        await insertItems(connection, gradeSixId, getTemplateIndicators(subject, 6), sourceId);
      }
    }

    for (const [alias, canonicalSubject] of Object.entries(subjectAliases)) {
      const educationLevel = schoolSubjects.has(canonicalSubject) ? 'school' : 'professional';
      const packageId = await upsertPackage(connection, {
        packageKey: `legacy:${slug(alias)}:${educationLevel}:general`,
        title: `${alias} — plantilla general`,
        subject: alias,
        educationLevel,
        gradeLabel: 'general'
      });
      await insertItems(connection, packageId, getTemplateIndicators(canonicalSubject), sourceId);
      if (canonicalSubject === 'Matemáticas') {
        const gradeSixId = await upsertPackage(connection, {
          packageKey: `legacy:${slug(alias)}:${educationLevel}:grade-6`,
          title: `${alias} — grado 6`,
          subject: alias,
          educationLevel,
          gradeLabel: '6'
        });
        await insertItems(connection, gradeSixId, getTemplateIndicators(canonicalSubject, 6), sourceId);
      }
    }

    await connection.commit();
    console.log('Legacy internal suggestions seeded in seio_db_pruebas.');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Template catalog seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

run();
