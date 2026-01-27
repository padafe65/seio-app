#!/usr/bin/env node
/**
 * Añade report_brand_name y report_logo_url a teachers si no existen.
 * Uso: node server/scripts/run-migration-report-brand.js
 *      npm run migrate:report-brand (desde raíz)
 */
import pool from '../config/db.js';

async function run() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM teachers LIKE 'report_brand_name'");
    if (cols.length > 0) {
      console.log('✅ report_brand_name ya existe en teachers.');
    } else {
      await pool.query(`
        ALTER TABLE teachers
          ADD COLUMN report_brand_name VARCHAR(120) DEFAULT NULL
            COMMENT 'Nombre comercial para reportes PDF (marca blanca)' AFTER subject
      `);
      console.log('✅ Añadido report_brand_name a teachers.');
    }

    const [cols2] = await pool.query("SHOW COLUMNS FROM teachers LIKE 'report_logo_url'");
    if (cols2.length > 0) {
      console.log('✅ report_logo_url ya existe en teachers.');
    } else {
      await pool.query(`
        ALTER TABLE teachers
          ADD COLUMN report_logo_url VARCHAR(512) DEFAULT NULL
            COMMENT 'URL o ruta del logo para reportes (opcional)' AFTER report_brand_name
      `);
      console.log('✅ Añadido report_logo_url a teachers.');
    }
  } catch (e) {
    console.error('❌ Error en migración:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
