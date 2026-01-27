#!/usr/bin/env node
/**
 * Añade from_template a indicators si no existe.
 * Uso: node server/scripts/run-migration-from-template.js
 */
import pool from '../config/db.js';

async function run() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM indicators LIKE 'from_template'");
    if (cols.length > 0) {
      console.log('✅ from_template ya existe en indicators.');
    } else {
      await pool.query(`
        ALTER TABLE indicators
          ADD COLUMN from_template TINYINT(1) NOT NULL DEFAULT 0
          COMMENT '1 si se creó al aplicar plantilla por asignatura'
      `);
      console.log('✅ Añadido from_template a indicators.');
    }
    const [r] = await pool.query(`
      UPDATE indicators SET from_template = 1
      WHERE questionnaire_id IS NULL
        AND subject IN ('Matemáticas', 'Inglés', 'Español', 'Física 1', 'Química')
        AND COALESCE(TRIM(grade), '') != ''
        AND from_template = 0
    `);
    if (r.affectedRows > 0) console.log('✅ Marcados ' + r.affectedRows + ' indicadores existentes como plantillas aplicadas.');
  } catch (e) {
    console.error('❌ Error en migración:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
