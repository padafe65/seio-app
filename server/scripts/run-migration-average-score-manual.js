#!/usr/bin/env node
/**
 * Ejecuta la migración 20260123_add_average_score_manual_to_phase_averages.
 * Añade average_score_manual a phase_averages si no existe.
 * Uso: node server/scripts/run-migration-average-score-manual.js
 *      o: npm run migrate:average-score-manual (desde raíz)
 */
import pool from '../config/db.js';

async function run() {
  try {
    const [cols] = await pool.query(
      "SHOW COLUMNS FROM phase_averages LIKE 'average_score_manual'"
    );
    if (cols.length > 0) {
      console.log('✅ average_score_manual ya existe en phase_averages. Nada que hacer.');
      process.exit(0);
      return;
    }
    await pool.query(`
      ALTER TABLE phase_averages
        ADD COLUMN average_score_manual DECIMAL(5,2) DEFAULT NULL
          COMMENT 'Nota manual del docente para la fase. Si no es NULL, la definitiva se promedia con average_score.'
          AFTER average_score
    `);
    console.log('✅ Migración aplicada: average_score_manual añadido a phase_averages.');
  } catch (e) {
    console.error('❌ Error en migración:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
