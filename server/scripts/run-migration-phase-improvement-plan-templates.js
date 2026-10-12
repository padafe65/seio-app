#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import pool from '../config/db.js';

async function run() {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS database_name');
    const databaseName = rows[0]?.database_name;
    if (databaseName !== 'seio_db_pruebas') {
      throw new Error(`Seguridad: conectado a "${databaseName || 'desconocida'}". Esta migración solo se ejecuta automáticamente en seio_db_pruebas.`);
    }
    const sql = await readFile(new URL('../migrations/20261011_create_phase_improvement_plan_templates.sql', import.meta.url), 'utf8');
    const statements = sql.split(';').map(statement => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      const addColumn = statement.match(/ALTER\s+TABLE\s+improvement_plans\s+ADD\s+COLUMN\s+(\w+)/i);
      if (addColumn) {
        const [columns] = await pool.query(`SHOW COLUMNS FROM improvement_plans LIKE '${addColumn[1]}'`);
        if (columns.length) continue;
      }
      await pool.query(statement);
    }
    console.log('Plantillas por fase y campos de entrega creados o ya existentes en seio_db_pruebas.');
  } catch (error) {
    console.error('No se pudo aplicar la migración:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
