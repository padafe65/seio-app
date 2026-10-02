#!/usr/bin/env node
/** Allow subject-template indicators to omit a grade when they are reusable. */
import pool from '../config/db.js';

async function run() {
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM indicators LIKE 'grade'");
    if (!columns.length) throw new Error('No se encontró la columna indicators.grade');
    if (String(columns[0].Null).toUpperCase() === 'YES') {
      console.log('La columna indicators.grade ya permite valores vacíos.');
    } else {
      await pool.query('ALTER TABLE indicators MODIFY grade INT NULL');
      console.log('La columna indicators.grade ahora permite valores vacíos.');
    }

    for (const [name, definition] of [
      ['course_id', 'INT NULL'],
      ['institution', 'VARCHAR(150) NULL']
    ]) {
      const [existing] = await pool.query(`SHOW COLUMNS FROM indicators LIKE '${name}'`);
      if (existing.length === 0) {
        await pool.query(`ALTER TABLE indicators ADD COLUMN ${name} ${definition}`);
        console.log(`Añadida la columna indicators.${name}.`);
      } else {
        console.log(`La columna indicators.${name} ya existe.`);
      }
    }

    for (const [name, definition] of [
      ['course_id', 'INT NULL'],
      ['institution', 'VARCHAR(150) NULL']
    ]) {
      const [existing] = await pool.query(`SHOW COLUMNS FROM educational_resources LIKE '${name}'`);
      if (existing.length === 0) {
        await pool.query(`ALTER TABLE educational_resources ADD COLUMN ${name} ${definition}`);
        console.log(`Añadida la columna educational_resources.${name}.`);
      } else {
        console.log(`La columna educational_resources.${name} ya existe.`);
      }
    }
  } catch (error) {
    console.error('Error al actualizar indicators.grade:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
