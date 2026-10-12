#!/usr/bin/env node
/** Create the template catalog only in the isolated seio_db_pruebas database. */
import { readFile } from 'node:fs/promises';
import pool from '../config/db.js';

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        current += char;
      }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      current += char;
      if (char === '\\' && next) {
        current += next;
        index += 1;
      } else if (char === quote) {
        if (next === quote) {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if ((char === '-' && next === '-') || char === '#') {
      lineComment = true;
      index += char === '-' ? 1 : 0;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function run() {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS database_name');
    const databaseName = rows[0]?.database_name;
    if (databaseName !== 'seio_db_pruebas') {
      throw new Error(`Safety stop: connected database is "${databaseName || 'unknown'}". Expected "seio_db_pruebas".`);
    }

    const sql = await readFile(new URL('../migrations/20261011_create_indicator_template_catalog.sql', import.meta.url), 'utf8');
    const statements = splitSqlStatements(sql);

    for (const statement of statements) await pool.query(statement);
    for (const [name, definition] of [
      ['education_level', 'VARCHAR(40) NULL'],
      ['grade_label', 'VARCHAR(40) NULL']
    ]) {
      const [columns] = await pool.query(`SHOW COLUMNS FROM indicators LIKE '${name}'`);
      if (!columns.length) await pool.query(`ALTER TABLE indicators ADD COLUMN ${name} ${definition}`);
    }
    const [courseLevelColumn] = await pool.query("SHOW COLUMNS FROM courses LIKE 'education_level'");
    if (!courseLevelColumn.length) {
      await pool.query("ALTER TABLE courses ADD COLUMN education_level VARCHAR(40) NULL");
    }
    console.log('Template catalog schema created in seio_db_pruebas.');
  } catch (error) {
    console.error('Template catalog migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
