import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pool from '../config/db.js';

const migrationPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations/20261021_student_preicfes_registration.sql');

async function run() {
  try {
    const sql = (await readFile(migrationPath, 'utf8')).replace(/^\s*--.*$/gm, '');
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await pool.query(statement);
    console.log('Migración aplicada: modalidad de registro Preicfes.');
  } catch (error) {
    console.error('No se pudo aplicar la migración de registro Preicfes:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
