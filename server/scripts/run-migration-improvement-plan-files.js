#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import pool from '../config/db.js';

async function run() {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS database_name');
    const databaseName = rows[0]?.database_name;
    if (databaseName !== 'seio_db_pruebas') {
      throw new Error(`Seguridad: conectado a "${databaseName || 'desconocida'}". Esta migración solo se ejecuta en seio_db_pruebas.`);
    }
    const sql = await readFile(new URL('../migrations/20261013_improvement_plan_files_and_delivery.sql', import.meta.url), 'utf8');
    const statements = sql.split(';').map(statement => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      const addColumns = statement.match(/^ALTER\s+TABLE\s+improvement_plans\s+([\s\S]+)$/i);
      if (addColumns) {
        const parts = addColumns[1].split(',').map(part => part.trim()).filter(Boolean);
        for (const part of parts) {
          const column = part.match(/^ADD\s+COLUMN\s+(\w+)\s+([\s\S]+)$/i);
          if (!column) continue;
          const [existing] = await pool.query('SHOW COLUMNS FROM improvement_plans LIKE ?', [column[1]]);
          if (!existing.length) await pool.query(`ALTER TABLE improvement_plans ADD COLUMN ${column[1]} ${column[2]}`);
        }
      } else {
        await pool.query(statement);
      }
    }
    console.log('Campos para publicar PDF y tabla de entregas creados o ya existentes en seio_db_pruebas.');
  } catch (error) {
    console.error('No se pudo aplicar la migración:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
